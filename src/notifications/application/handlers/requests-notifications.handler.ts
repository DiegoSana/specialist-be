import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { NotificationService } from '../services/notification.service';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { RequestCreatedEvent } from '../../../requests/domain/events/request-created.event';
import { RequestInterestExpressedEvent } from '../../../requests/domain/events/request-interest-expressed.event';
import { RequestProfessionalAssignedEvent } from '../../../requests/domain/events/request-professional-assigned.event';
import { RequestStatusChangedEvent } from '../../../requests/domain/events/request-status-changed.event';

/**
 * Application-level event handler that materializes in-app notifications
 * from Requests bounded-context events.
 *
 * For now we only support in-app. External channels will be added later.
 */
@Injectable()
export class RequestsNotificationsHandler implements OnModuleInit {
  private readonly logger = new Logger(RequestsNotificationsHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    private readonly notifications: NotificationService,
    private readonly professionalService: ProfessionalService,
  ) {}

  onModuleInit(): void {
    // The current event bus is in-memory and exposes `.on(...)`.
    if (typeof this.eventBus?.on !== 'function') {
      this.logger.warn(
        'EventBus does not support subscriptions; notifications will not be generated from events.',
      );
      return;
    }

    this.eventBus.on(RequestCreatedEvent.EVENT_NAME, () =>
      this.onRequestCreated(),
    );
    this.eventBus.on(
      RequestInterestExpressedEvent.EVENT_NAME,
      (event: RequestInterestExpressedEvent) => this.onInterestExpressed(event),
    );
    this.eventBus.on(
      RequestProfessionalAssignedEvent.EVENT_NAME,
      (event: RequestProfessionalAssignedEvent) =>
        this.onProfessionalAssigned(event),
    );
    this.eventBus.on(
      RequestStatusChangedEvent.EVENT_NAME,
      (event: RequestStatusChangedEvent) => this.onStatusChanged(event),
    );
  }

  // RequestCreated should NOT notify, but we still subscribe so it's explicit.
  private async onRequestCreated(): Promise<void> {
    return;
  }

  private async onInterestExpressed(
    event: RequestInterestExpressedEvent,
  ): Promise<void> {
    try {
      await this.notifications.createForUser({
        userId: event.payload.clientId,
        type: 'REQUEST_INTEREST_EXPRESSED',
        title: 'Un especialista está interesado en tu solicitud',
        body: 'Revisá los especialistas interesados y elegí el que prefieras.',
        data: {
          requestId: event.payload.requestId,
          professionalId: event.payload.professionalId,
        },
        idempotencyKey: `${event.name}:${event.payload.requestId}:${event.payload.professionalId}:${event.payload.clientId}`,
        includeExternal: true,
      });
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (requestId=${event.payload.requestId}, clientId=${event.payload.clientId}, professionalId=${event.payload.professionalId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async onProfessionalAssigned(
    event: RequestProfessionalAssignedEvent,
  ): Promise<void> {
    try {
      const professional = await this.professionalService.getByIdOrFail(
        event.payload.professionalId,
      );

      await this.notifications.createForUser({
        userId: professional.userId,
        type: 'REQUEST_PROFESSIONAL_ASSIGNED',
        title: 'Te asignaron a una solicitud',
        body: 'El cliente aceptó tu interés. Revisá los detalles de la solicitud.',
        data: {
          requestId: event.payload.requestId,
          professionalId: event.payload.professionalId,
        },
        idempotencyKey: `${event.name}:${event.payload.requestId}:${professional.userId}:${event.payload.professionalId}`,
        includeExternal: true,
      });
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (requestId=${event.payload.requestId}, professionalId=${event.payload.professionalId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async onStatusChanged(
    event: RequestStatusChangedEvent,
  ): Promise<void> {
    try {
      // Rule (given): every status change notifies (in-app + external later)
      // For now, we generate in-app notifications.
      const title = 'Actualización de tu solicitud';
      const body = this.statusChangeBody(
        event.payload.fromStatus,
        event.payload.toStatus,
      );

      await this.notifications.createForUser({
        userId: event.payload.clientId,
        type: 'REQUEST_STATUS_CHANGED',
        title,
        body,
        data: {
          requestId: event.payload.requestId,
          fromStatus: event.payload.fromStatus,
          toStatus: event.payload.toStatus,
        },
        idempotencyKey: `${event.name}:${event.payload.requestId}:${event.payload.clientId}:${event.payload.fromStatus}->${event.payload.toStatus}`,
        includeExternal: true,
        requireExternal: true,
      });

      // If there's an assigned professional, notify them too.
      if (event.payload.professionalId) {
        const professional = await this.professionalService.getByIdOrFail(
          event.payload.professionalId,
        );
        await this.notifications.createForUser({
          userId: professional.userId,
          type: 'REQUEST_STATUS_CHANGED',
          title: 'Actualización de una solicitud asignada',
          body,
          data: {
            requestId: event.payload.requestId,
            fromStatus: event.payload.fromStatus,
            toStatus: event.payload.toStatus,
          },
          idempotencyKey: `${event.name}:${event.payload.requestId}:${professional.userId}:${event.payload.fromStatus}->${event.payload.toStatus}`,
          includeExternal: true,
          requireExternal: true,
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (requestId=${event.payload.requestId}, clientId=${event.payload.clientId}, from=${event.payload.fromStatus}, to=${event.payload.toStatus}, professionalId=${event.payload.professionalId ?? 'n/a'})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private statusChangeBody(from: RequestStatus, to: RequestStatus): string {
    if (to === RequestStatus.ACCEPTED) {
      return 'La solicitud fue aceptada.';
    }
    if (to === RequestStatus.IN_PROGRESS) {
      return 'La solicitud está en progreso.';
    }
    if (to === RequestStatus.DONE) {
      return 'La solicitud se marcó como finalizada.';
    }
    if (to === RequestStatus.CANCELLED) {
      return 'La solicitud fue cancelada.';
    }
    return `La solicitud cambió de estado: ${from} → ${to}.`;
  }
}
