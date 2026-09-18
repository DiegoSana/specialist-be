import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { NotificationService } from '../services/notification.service';
import { UserService } from '../../../identity/application/services/user.service';
import { SupportConversationAttentionFlaggedEvent } from '../../../support/domain/events/support-conversation-attention-flagged.event';

const TITLE = 'Nueva conversación de soporte por WhatsApp';

/**
 * Notifies every admin when a support conversation needs attention: created for the
 * first time, or reopened by a new inbound message after being RESOLVED (see
 * SupportConversationService.receiveInboundMessage - never on message 2..N of an
 * already-OPEN conversation). Mirrors RequestAttentionFlaggedHandler's cross-context
 * fan-out pattern; in-app only (includeExternal: false), same as that handler - the
 * admin already lives in the panel, unlike the opt-out notice which forces email.
 */
@Injectable()
export class SupportConversationAttentionFlaggedHandler
  implements OnModuleInit
{
  private readonly logger = new Logger(
    SupportConversationAttentionFlaggedHandler.name,
  );

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    private readonly notifications: NotificationService,
    private readonly userService: UserService,
  ) {}

  onModuleInit(): void {
    if (typeof this.eventBus?.on !== 'function') {
      this.logger.warn(
        'EventBus does not support subscriptions; support conversation notifications will not be generated.',
      );
      return;
    }

    this.eventBus.on(
      SupportConversationAttentionFlaggedEvent.EVENT_NAME,
      (event: SupportConversationAttentionFlaggedEvent) =>
        this.onFlagged(event),
    );
  }

  private async onFlagged(
    event: SupportConversationAttentionFlaggedEvent,
  ): Promise<void> {
    try {
      const { conversationId, phoneNumber, userId } = event.payload;
      const adminUserIds = await this.userService.findAdminUserIds();

      if (adminUserIds.length === 0) {
        this.logger.warn(
          `Support conversation ${conversationId} needs attention but there are no admin users to notify`,
        );
        return;
      }

      const body = `Nuevo mensaje de ${phoneNumber} en el canal de soporte. Requiere revisión en el panel de administración.`;

      await Promise.all(
        adminUserIds.map((adminUserId) =>
          this.notifications.createForUser({
            userId: adminUserId,
            type: 'SUPPORT_CONVERSATION_NEEDS_ATTENTION',
            title: TITLE,
            body,
            data: { conversationId, phoneNumber, userId },
            idempotencyKey: `${event.name}:${conversationId}:${event.occurredAt.getTime()}:${adminUserId}`,
            includeExternal: false,
          }),
        ),
      );
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (conversationId=${event.payload.conversationId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
