import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InteractionDirection, RequestStatus } from '@prisma/client';
import {
  REQUEST_INTERACTION_REPOSITORY,
  RequestInteractionRepository,
} from '../../domain/repositories/request-interaction.repository';
import {
  REQUEST_REPOSITORY,
  RequestRepository,
} from '../../domain/repositories/request.repository';
import { RequestInteractionService } from '../services/request-interaction.service';
import { UserService } from '../../../identity/application/services/user.service';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';
import type { IFollowUpRule } from '../../domain/follow-up';
import { FollowUpQueryExecutor } from '../follow-up/follow-up-query-executor';
import { RequestEntity } from '../../domain/entities/request.entity';

export const FOLLOW_UP_RULES = Symbol('FOLLOW_UP_RULES');

/**
 * Cron job that schedules follow-up interactions for requests.
 * Delegates candidate selection to FollowUpQueryExecutor and payload building to each IFollowUpRule.
 */
@Injectable()
export class FollowUpSchedulerJob {
  private readonly logger = new Logger(FollowUpSchedulerJob.name);

  constructor(
    @Inject(FOLLOW_UP_RULES)
    private readonly followUpRules: IFollowUpRule[],
    private readonly queryExecutor: FollowUpQueryExecutor,
    @Inject(REQUEST_INTERACTION_REPOSITORY)
    private readonly interactionRepository: RequestInteractionRepository,
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
    private readonly interactionService: RequestInteractionService,
    private readonly config: ConfigService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => ProfessionalService))
    private readonly professionalService: ProfessionalService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
  ) {}

  @Cron('0 * * * *')
  async scheduleFollowUps(): Promise<void> {
    const startTime = Date.now();
    const enabled = this.config.get<string>(
      'WHATSAPP_FOLLOWUP_ENABLED',
      'false',
    );

    if (enabled !== 'true') {
      this.logger.debug('WhatsApp follow-ups are disabled');
      return;
    }

    this.logger.debug('Starting follow-up scheduler job');

    try {
      const now = new Date();
      let totalScheduled = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (const rule of this.followUpRules) {
        try {
          const result = await this.processFollowUpRule(rule, now);
          totalScheduled += result.scheduled;
          totalSkipped += result.skipped;
        } catch (error: any) {
          totalErrors++;
          this.logger.error(
            `Error processing follow-up rule ${rule.getName()}: Error=${error.message}`,
            error.stack,
          );
        }
      }

      const duration = Date.now() - startTime;
      if (totalScheduled > 0 || totalSkipped > 0 || totalErrors > 0) {
        this.logger.log(
          `Follow-up scheduler job completed: Scheduled=${totalScheduled}, Skipped=${totalSkipped}, Errors=${totalErrors}, Duration=${duration}ms`,
        );
      } else {
        this.logger.debug(
          `Follow-up scheduler job completed: No follow-ups needed, Duration=${duration}ms`,
        );
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Follow-up scheduler job failed: Error=${error.message}, Duration=${duration}ms`,
        error.stack,
      );
    }
  }

  private async processFollowUpRule(
    rule: IFollowUpRule,
    now: Date,
  ): Promise<{ scheduled: number; skipped: number }> {
    const name = rule.getName();
    const query = rule.getQuery();

    const requests = await this.queryExecutor.getRequests(query, now);
    if (requests.length === 0) {
      return { scheduled: 0, skipped: 0 };
    }

    const queryLabel =
      query.type === 'BY_STATUS'
        ? `Status=${query.status}, Days=${query.days}`
        : `PENDING with interests, Days=${query.days}`;
    this.logger.debug(
      `Processing rule ${name}: Found ${requests.length} requests (${queryLabel})`,
    );

    let scheduled = 0;
    let skipped = 0;

    for (const request of requests) {
      try {
        const result = await this.buildAndScheduleFollowUp(rule, request, now);
        if (result.scheduled) {
          scheduled++;
        } else {
          skipped++;
          this.logger.debug(
            `Skipping RequestId=${request.id}: ${result.reason}`,
          );
        }
      } catch (error: any) {
        skipped++;
        this.logger.error(
          `Failed to schedule follow-up: RequestId=${request.id}, Rule=${name}, Error=${error.message}`,
          error.stack,
        );
      }
    }

    if (scheduled > 0 || skipped > 0) {
      this.logger.log(
        `Rule ${name} processed: Scheduled=${scheduled}, Skipped=${skipped}`,
      );
    }

    return { scheduled, skipped };
  }

  /**
   * Evaluate the cron-time guards for a single (rule, request) pair and, if they
   * all pass, build the payload and create the pending follow-up interaction.
   * Shared by the hourly cron (`processFollowUpRule`) and the caller must apply
   * its own guards on top when bypassing time (see `forceTriggerRule`, which
   * deliberately skips `hasPendingFollowUp` / "recent interaction" here).
   */
  private async buildAndScheduleFollowUp(
    rule: IFollowUpRule,
    request: RequestEntity,
    now: Date,
  ): Promise<{ scheduled: boolean; reason?: string }> {
    const direction = rule.getDirection();
    const template = rule.getTemplate();

    const hasPending = await this.interactionRepository.hasPendingFollowUp(
      request.id,
    );
    if (hasPending) {
      return { scheduled: false, reason: 'Already has pending follow-up' };
    }

    const lastInteraction =
      await this.interactionRepository.findMostRecentByRequestId(request.id);
    if (lastInteraction) {
      const daysSince =
        (now.getTime() - lastInteraction.createdAt.getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSince < 1) {
        return {
          scheduled: false,
          reason: `Recent interaction ${daysSince.toFixed(2)} days ago`,
        };
      }
    }

    const canReceive = await this.canReceiveFollowUp(request, direction);
    if (!canReceive) {
      return {
        scheduled: false,
        reason:
          'Cannot receive follow-up (missing recipient or unverified phone)',
      };
    }

    let payload;
    try {
      payload = await rule.buildPayload(request);
    } catch (e: any) {
      return { scheduled: false, reason: `buildPayload failed (${e.message})` };
    }

    await this.interactionService.createFollowUp({
      requestId: request.id,
      direction,
      messageTemplate: template,
      scheduledFor: now,
      metadata: payload.metadata,
      templateVariables: payload.templateVariables,
    });

    this.logger.debug(
      `Scheduled follow-up: RequestId=${request.id}, Rule=${rule.getName()}, Template=${template}`,
    );

    return { scheduled: true };
  }

  /** Rule names available to force-trigger, for the admin config endpoint. */
  getAvailableRuleNames(): string[] {
    return this.followUpRules.map((r) => r.getName());
  }

  /**
   * Immediately fire a follow-up rule for one request, bypassing the time-based
   * scheduling (no waiting for the hourly cron, no backdating the request).
   *
   * Validates the request's CURRENT real state against the rule's non-time
   * condition (status for BY_STATUS rules; "has interests" for
   * PENDING_WITH_INTERESTS, reusing the same check the rule's buildPayload
   * already performs rather than reinventing it) and the same recipient
   * eligibility check the cron uses (`canReceiveFollowUp`). It deliberately
   * skips `hasPendingFollowUp` and the "<1 day since last interaction" guards:
   * those exist only to stop the automatic cron from spamming, and this is an
   * explicit human action.
   */
  async forceTriggerRule(
    ruleName: string,
    requestId: string,
  ): Promise<{ interactionId: string }> {
    const rule = this.followUpRules.find((r) => r.getName() === ruleName);
    if (!rule) {
      throw new NotFoundException(`Follow-up rule '${ruleName}' not found`);
    }

    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException(`Request with id ${requestId} not found`);
    }

    const query = rule.getQuery();
    if (query.type === 'BY_STATUS') {
      if (request.status !== query.status) {
        throw new BadRequestException(
          `Request status is ${request.status}, but rule '${ruleName}' requires ${query.status}. Change the request status first.`,
        );
      }
    } else if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Request status is ${request.status}, but rule '${ruleName}' requires PENDING. Change the request status first.`,
      );
    }

    const canReceive = await this.canReceiveFollowUp(
      request,
      rule.getDirection(),
    );
    if (!canReceive) {
      throw new BadRequestException(
        'Recipient cannot receive a follow-up (missing phone or unverified phone)',
      );
    }

    let payload;
    try {
      payload = await rule.buildPayload(request);
    } catch (e: any) {
      throw new BadRequestException(
        `Cannot trigger rule '${ruleName}': ${e.message}`,
      );
    }

    const interaction = await this.interactionService.createFollowUp({
      requestId: request.id,
      direction: rule.getDirection(),
      messageTemplate: rule.getTemplate(),
      scheduledFor: new Date(),
      metadata: payload.metadata,
      templateVariables: payload.templateVariables,
    });

    await this.interactionService.sendMessage(interaction.id);

    return { interactionId: interaction.id };
  }

  private async canReceiveFollowUp(
    request: RequestEntity,
    direction: InteractionDirection,
  ): Promise<boolean> {
    if (direction === InteractionDirection.TO_PROVIDER) {
      if (!request.providerId) {
        return false;
      }
      try {
        const professional =
          await this.professionalService.findByServiceProviderId(
            request.providerId,
          );
        if (professional) {
          const user = await this.userService.findById(professional.userId);
          return !!(user?.phone && user.phoneVerified);
        }
        const company = await this.companyService.findByServiceProviderId(
          request.providerId,
        );
        if (company) {
          const user = await this.userService.findById(company.userId);
          return !!(user?.phone && user.phoneVerified);
        }
      } catch (error) {
        this.logger.warn(
          `Error checking provider phone for request ${request.id}`,
          error,
        );
        return false;
      }
      return false;
    } else {
      if (!request.clientId) {
        return false;
      }
      try {
        const user = await this.userService.findById(request.clientId);
        return !!(user?.phone && user.phoneVerified);
      } catch (error) {
        this.logger.warn(
          `Error checking client phone for request ${request.id}`,
          error,
        );
        return false;
      }
    }
  }
}
