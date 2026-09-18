import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { NotificationService } from '../services/notification.service';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';
import { CompanyStatusChangedEvent } from '../../../profiles/domain/events/company-status-changed.event';
import { CompanyStatus } from '../../../profiles/domain/entities/company.entity';

/**
 * Tells a company owner the outcome of an admin status change. Only outcomes the owner must
 * know about are notified (approved, rejected, suspended); other transitions are silent.
 * EMAIL is forced as the external channel, mirroring UserWhatsAppOptedOutHandler: the owner may
 * not be reachable by WhatsApp and a verification result must not be silently dropped.
 */
@Injectable()
export class CompanyStatusChangedHandler implements OnModuleInit {
  private readonly logger = new Logger(CompanyStatusChangedHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    if (typeof this.eventBus?.on !== 'function') {
      this.logger.warn(
        'EventBus does not support subscriptions; company status notifications will not be generated.',
      );
      return;
    }

    this.eventBus.on(
      CompanyStatusChangedEvent.EVENT_NAME,
      (event: CompanyStatusChangedEvent) => this.onStatusChanged(event),
    );
  }

  private buildMessage(
    companyName: string,
    newStatus: CompanyStatus,
  ): { type: string; title: string; body: string } | null {
    switch (newStatus) {
      case CompanyStatus.ACTIVE:
      case CompanyStatus.VERIFIED:
        return {
          type: 'COMPANY_VERIFIED',
          title: 'Tu empresa fue verificada',
          body: `${companyName} ya está activa: podés mostrar interés en solicitudes y aparecer en el catálogo de especialistas.`,
        };
      case CompanyStatus.REJECTED:
        return {
          type: 'COMPANY_REJECTED',
          title: 'Tu empresa fue rechazada',
          body: `No pudimos verificar a ${companyName}. Si creés que es un error, contactate con soporte.`,
        };
      case CompanyStatus.SUSPENDED:
        return {
          type: 'COMPANY_SUSPENDED',
          title: 'Tu empresa fue suspendida',
          body: `${companyName} fue suspendida y no puede operar por ahora. Contactate con soporte para más información.`,
        };
      default:
        return null;
    }
  }

  private async onStatusChanged(
    event: CompanyStatusChangedEvent,
  ): Promise<void> {
    try {
      const { userId, companyId, companyName, newStatus } = event.payload;
      const message = this.buildMessage(companyName, newStatus);
      if (!message) return;

      await this.notifications.createForUser({
        userId,
        type: message.type,
        title: message.title,
        body: message.body,
        data: { companyId, status: newStatus },
        includeExternal: true,
        requireExternal: true,
        forceExternalChannel: NotificationChannel.EMAIL,
        idempotencyKey: `${event.name}:${companyId}:${event.occurredAt.getTime()}`,
      });
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (companyId=${event.payload.companyId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
