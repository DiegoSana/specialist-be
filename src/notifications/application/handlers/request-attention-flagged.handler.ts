import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RequestAttentionReason } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { NotificationService } from '../services/notification.service';
import { UserService } from '../../../identity/application/services/user.service';
import { RequestAttentionFlaggedEvent } from '../../../requests/domain/events/request-attention-flagged.event';

const REASON_LABELS: Record<RequestAttentionReason, string> = {
  AT_RISK: 'en riesgo (sin respuesta)',
  ABANDONED: 'posiblemente abandonada',
  ESCALATED: 'escalada por el usuario',
};

/**
 * Notifies every admin when a request is flagged for attention (RequestAttentionService),
 * whether the flag came from the follow-up scheduler (silence past the ladder) or from
 * the WhatsApp reply classifier (viability=ABANDONED or escalate=true on an actual reply).
 * One consumer for all three reasons, so there's a single place admins learn to check.
 */
@Injectable()
export class RequestAttentionFlaggedHandler implements OnModuleInit {
  private readonly logger = new Logger(RequestAttentionFlaggedHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    private readonly notifications: NotificationService,
    private readonly userService: UserService,
  ) {}

  onModuleInit(): void {
    if (typeof this.eventBus?.on !== 'function') {
      this.logger.warn(
        'EventBus does not support subscriptions; attention-flag notifications will not be generated.',
      );
      return;
    }

    this.eventBus.on(
      RequestAttentionFlaggedEvent.EVENT_NAME,
      (event: RequestAttentionFlaggedEvent) => this.onFlagged(event),
    );
  }

  private async onFlagged(event: RequestAttentionFlaggedEvent): Promise<void> {
    try {
      const { attentionFlagId, requestId, reason, detail } = event.payload;
      const adminUserIds = await this.userService.findAdminUserIds();

      if (adminUserIds.length === 0) {
        this.logger.warn(
          `Request ${requestId} flagged (${reason}) but there are no admin users to notify`,
        );
        return;
      }

      const title = `Solicitud ${REASON_LABELS[reason]}`;
      const body = detail
        ? `Requiere revisión: ${detail}`
        : 'Requiere revisión en el panel de administración.';

      await Promise.all(
        adminUserIds.map((adminUserId) =>
          this.notifications.createForUser({
            userId: adminUserId,
            type: 'REQUEST_ATTENTION_FLAGGED',
            title,
            body,
            data: { requestId, attentionFlagId, reason },
            idempotencyKey: `${event.name}:${attentionFlagId}:${adminUserId}`,
            includeExternal: false,
          }),
        ),
      );
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (requestId=${event.payload.requestId}, reason=${event.payload.reason})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
