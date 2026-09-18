import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { NotificationService } from '../services/notification.service';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';
import { UserWhatsAppOptedOutEvent } from '../../../identity/domain/events/user-whatsapp-opted-out.event';
import { UserWhatsAppReactivatedEvent } from '../../../identity/domain/events/user-whatsapp-reactivated.event';

const OPTED_OUT_TITLE = 'Te diste de baja de WhatsApp';
const OPTED_OUT_BODY =
  'Te desuscribiste de los mensajes de WhatsApp (por tu propio pedido o por una acción de un ' +
  'administrador). Como WhatsApp es necesario para coordinar solicitudes en la plataforma, no ' +
  'vas a poder crear solicitudes ni mostrar interés en ellas hasta que esto se revierta. Si fue ' +
  'un error, contactate con soporte.';

const REACTIVATED_TITLE = 'Volviste a habilitar WhatsApp';
const REACTIVATED_BODY =
  'Un administrador revirtió tu baja de WhatsApp: ya podés volver a crear solicitudes y ' +
  'mostrar interés en ellas, y vamos a poder coordinar por WhatsApp de nuevo.';

/**
 * Notifies a user on both sides of User.whatsappOptedOut: when they transition into it (either
 * the WhatsApp reply classifier or the admin manual override in Identity - both publish
 * UserWhatsAppOptedOutEvent, see UserService.setWhatsAppOptedOut) and when an admin reverts it
 * (UserWhatsAppReactivatedEvent - there's no self-service/automatic reactivation path yet).
 * Both notifications force EMAIL as the external channel: WhatsApp - the usual external channel
 * for this user base - is unavailable (opt-out case) or was just unreliable enough to need this
 * notice in the first place (reactivation case), so honoring the user's preferredExternalChannel
 * (if it happens to be WHATSAPP) would risk silently dropping the message.
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
        'EventBus does not support subscriptions; WhatsApp opt-out/reactivation notifications will not be generated.',
      );
      return;
    }

    this.eventBus.on(
      UserWhatsAppOptedOutEvent.EVENT_NAME,
      (event: UserWhatsAppOptedOutEvent) => this.onOptedOut(event),
    );
    this.eventBus.on(
      UserWhatsAppReactivatedEvent.EVENT_NAME,
      (event: UserWhatsAppReactivatedEvent) => this.onReactivated(event),
    );
  }

  private async onOptedOut(event: UserWhatsAppOptedOutEvent): Promise<void> {
    try {
      const { userId } = event.payload;

      await this.notifications.createForUser({
        userId,
        type: 'WHATSAPP_OPTED_OUT',
        title: OPTED_OUT_TITLE,
        body: OPTED_OUT_BODY,
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

  private async onReactivated(
    event: UserWhatsAppReactivatedEvent,
  ): Promise<void> {
    try {
      const { userId } = event.payload;

      await this.notifications.createForUser({
        userId,
        type: 'WHATSAPP_REACTIVATED',
        title: REACTIVATED_TITLE,
        body: REACTIVATED_BODY,
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
