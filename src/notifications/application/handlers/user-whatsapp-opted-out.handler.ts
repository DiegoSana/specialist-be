import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { NotificationService } from '../services/notification.service';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';
import { UserWhatsAppOptedOutEvent } from '../../../identity/domain/events/user-whatsapp-opted-out.event';

const TITLE = 'Te diste de baja de WhatsApp';
const BODY =
  'Te desuscribiste de los mensajes de WhatsApp (por tu propio pedido o por una acción de un ' +
  'administrador). Como WhatsApp es necesario para coordinar solicitudes en la plataforma, no ' +
  'vas a poder crear solicitudes ni mostrar interés en ellas hasta que esto se revierta. Si fue ' +
  'un error, contactate con soporte.';

/**
 * Notifies a user when they transition into User.whatsappOptedOut=true (either the WhatsApp
 * reply classifier or the admin manual override in Identity - both publish the same event, see
 * UserService.setWhatsAppOptedOut). Forces EMAIL as the external channel: WhatsApp - the usual
 * external channel for this user base - is unavailable to this user by definition, so honoring
 * their preferredExternalChannel (if it happens to be WHATSAPP) would silently drop the message.
 */
@Injectable()
export class UserWhatsAppOptedOutHandler implements OnModuleInit {
  private readonly logger = new Logger(UserWhatsAppOptedOutHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    if (typeof this.eventBus?.on !== 'function') {
      this.logger.warn(
        'EventBus does not support subscriptions; WhatsApp opt-out notifications will not be generated.',
      );
      return;
    }

    this.eventBus.on(
      UserWhatsAppOptedOutEvent.EVENT_NAME,
      (event: UserWhatsAppOptedOutEvent) => this.onOptedOut(event),
    );
  }

  private async onOptedOut(event: UserWhatsAppOptedOutEvent): Promise<void> {
    try {
      const { userId } = event.payload;

      await this.notifications.createForUser({
        userId,
        type: 'WHATSAPP_OPTED_OUT',
        title: TITLE,
        body: BODY,
        includeExternal: true,
        requireExternal: true,
        forceExternalChannel: NotificationChannel.EMAIL,
        idempotencyKey: `${event.name}:${userId}:${event.occurredAt.getTime()}`,
      });
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (userId=${event.payload.userId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
