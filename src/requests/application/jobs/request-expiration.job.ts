import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RequestStatus } from '@prisma/client';
import {
  REQUEST_REPOSITORY,
  RequestRepository,
} from '../../domain/repositories/request.repository';
import { RequestService } from '../services/request.service';
import { AUTO_CLOSED_STATUS_REASON } from '../../domain/entities/request-status.metadata';

interface ExpirationRule {
  from: RequestStatus;
  to: RequestStatus;
  envVar: string;
  defaultDays: number;
  statusReason?: string;
}

/**
 * Sistema actor: moves requests that sat too long in a state to their timeout state, per
 * "docs/EspecialistBRC — Estados del pedido.md" ("Vence si"). Plazos are env parameters.
 *
 * TODO(open question in the spec): IN_PROGRESS -> ABANDONED is deliberately NOT applied here;
 * En curso only stops WhatsApp follow-ups and stays En curso.
 */
export const EXPIRATION_RULES: ExpirationRule[] = [
  {
    from: RequestStatus.PUBLISHED,
    to: RequestStatus.EXPIRED,
    envVar: 'REQUEST_EXPIRY_DAYS_PUBLISHED',
    defaultDays: 6,
  },
  {
    from: RequestStatus.SENT,
    to: RequestStatus.NO_RESPONSE,
    envVar: 'REQUEST_EXPIRY_DAYS_SENT',
    defaultDays: 6,
  },
  {
    // Reminders go out at 2/4/6 days; 8 leaves margin after the last one (assumption).
    from: RequestStatus.CONTACT_RELEASED,
    to: RequestStatus.ABANDONED,
    envVar: 'REQUEST_EXPIRY_DAYS_CONTACT_RELEASED',
    defaultDays: 8,
  },
  {
    // Automatic close: rating stays enabled, same as a client-confirmed close.
    from: RequestStatus.FINISHED,
    to: RequestStatus.CLOSED,
    envVar: 'REQUEST_EXPIRY_DAYS_FINISHED',
    defaultDays: 7,
    statusReason: AUTO_CLOSED_STATUS_REASON,
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RequestExpirationJob {
  private readonly logger = new Logger(RequestExpirationJob.name);

  constructor(
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
    private readonly requestService: RequestService,
    private readonly config: ConfigService,
  ) {}

  @Cron('30 * * * *')
  async applyExpirations(): Promise<void> {
    if (
      this.config.get<string>('REQUEST_EXPIRATION_ENABLED', 'false') !== 'true'
    ) {
      this.logger.debug('Request expiration is disabled');
      return;
    }

    const now = Date.now();
    const ctx = this.requestService.buildSystemAuthContext();
    let applied = 0;
    let skipped = 0;
    let errors = 0;

    for (const rule of EXPIRATION_RULES) {
      const days = this.resolveDays(rule);
      let candidates;
      try {
        candidates = await this.requestRepository.findStaleByStatus(
          rule.from,
          new Date(now - days * DAY_MS),
        );
      } catch (error: any) {
        errors++;
        this.logger.error(
          `Failed to load ${rule.from} candidates: ${error.message}`,
          error.stack,
        );
        continue;
      }

      for (const request of candidates) {
        try {
          // Idempotent: a concurrent/previous run may already have moved it.
          if (request.status !== rule.from) {
            skipped++;
            continue;
          }
          await this.requestService.updateStatus(request.id, ctx, {
            status: rule.to,
            statusReason: rule.statusReason,
          });
          applied++;
        } catch (error: any) {
          errors++;
          this.logger.error(
            `Failed to move request ${request.id} ${rule.from} -> ${rule.to}: ${error.message}`,
            error.stack,
          );
        }
      }
    }

    if (applied > 0 || skipped > 0 || errors > 0) {
      this.logger.log(
        `Request expiration job completed: Applied=${applied}, Skipped=${skipped}, Errors=${errors}`,
      );
    }
  }

  private resolveDays(rule: ExpirationRule): number {
    const raw = Number(this.config.get<string>(rule.envVar));
    return Number.isFinite(raw) && raw > 0 ? raw : rule.defaultDays;
  }
}
