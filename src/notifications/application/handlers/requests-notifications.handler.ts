import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { InAppNotificationService } from '../services/in-app-notification.service';
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
    private readonly notifications: InAppNotificationService,
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

    this.eventBus.on(RequestCreatedEvent.EVENT_NAME, (event: RequestCreatedEvent) =>
      this.onRequestCreated(event),
    );
    this.eventBus.on(
      RequestInterestExpressedEvent.EVENT_NAME,
      (event: RequestInterestExpressedEvent) => this.onInterestExpressed(event),
    );
    this.eventBus.on(
      RequestProfessionalAssignedEvent.EVENT_NAME,
      (event: RequestProfessionalAssignedEvent) => this.onProfessionalAssigned(event),
    );
    this.eventBus.on(
      RequestStatusChangedEvent.EVENT_NAME,
      (event: RequestStatusChangedEvent) => this.onStatusChanged(event),
    );
  }

  // RequestCreated should NOT notify, but we still subscribe so it's explicit.
  private async onRequestCreated(_event: RequestCreatedEvent): Promise<void> {
    return;
  }

  private async onInterestExpressed(
    event: RequestInterestExpressedEvent,
  ): Promise<void> {
    await this.notifications.createForUser({
      userId: event.payload.clientId,
      type: 'REQUEST_INTEREST_EXPRESSED',
      title: 'Un especialista está interesado en tu solicitud',
      body: 'Revisá los especialistas interesados y elegí el que prefieras.',
      data: {
        requestId: event.payload.requestId,
        professionalId: event.payload.professionalId,
      },
    });
  }

  private async onProfessionalAssigned(
    event: RequestProfessionalAssignedEvent,
  ): Promise<void> {
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
    });
  }

  private async onStatusChanged(event: RequestStatusChangedEvent): Promise<void> {
    // Rule (given): every status change notifies (in-app + external later)
    // For now, we generate in-app notifications.
    const title = 'Actualización de tu solicitud';
    const body = this.statusChangeBody(event.payload.fromStatus, event.payload.toStatus);

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
      });
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

