import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { NotificationService } from '../services/notification.service';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { RequestCreatedEvent } from '../../../requests/domain/events/request-created.event';
import { RequestInterestExpressedEvent } from '../../../requests/domain/events/request-interest-expressed.event';
import { RequestProfessionalAssignedEvent } from '../../../requests/domain/events/request-professional-assigned.event';
import { RequestStatusChangedEvent } from '../../../requests/domain/events/request-status-changed.event';
import { REQUEST_STATUS_LABELS_ES } from '../../../requests/domain/entities/request-status.metadata';

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
      // Use new providerName field, fallback to professionalName for backward compat
      const providerName =
        event.payload.providerName || event.payload.professionalName;
      const { requestTitle, serviceProviderId } = event.payload;

      const title = `${providerName} mostró interés en tu solicitud`;
      const body = requestTitle
        ? `"${requestTitle}" - Revisá los especialistas interesados y elegí el que prefieras.`
        : 'Revisá los especialistas interesados y elegí el que prefieras.';

      await this.notifications.createForUser({
        userId: event.payload.clientId,
        type: 'REQUEST_INTEREST_EXPRESSED',
        title,
        body,
        data: {
          requestId: event.payload.requestId,
          serviceProviderId,
          providerType: event.payload.providerType,
          // Backward compat
          professionalId: event.payload.professionalId,
        },
        idempotencyKey: `${event.name}:${event.payload.requestId}:${serviceProviderId}:${event.payload.clientId}`,
        includeExternal: true,
      });
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (requestId=${event.payload.requestId}, clientId=${event.payload.clientId}, serviceProviderId=${event.payload.serviceProviderId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async onProfessionalAssigned(
    event: RequestProfessionalAssignedEvent,
  ): Promise<void> {
    try {
      // Use providerUserId directly (no lookup needed)
      const { requestTitle, clientName, providerUserId, serviceProviderId } =
        event.payload;

      const title = `${clientName} te asignó a una solicitud`;
      const body = requestTitle
        ? `"${requestTitle}" - Revisá los detalles de la solicitud.`
        : 'Revisá los detalles de la solicitud.';

      await this.notifications.createForUser({
        userId: providerUserId,
        type: 'REQUEST_PROFESSIONAL_ASSIGNED',
        title,
        body,
        data: {
          requestId: event.payload.requestId,
          serviceProviderId,
          providerType: event.payload.providerType,
          // Backward compat
          professionalId: event.payload.professionalId,
        },
        idempotencyKey: `${event.name}:${event.payload.requestId}:${providerUserId}:${serviceProviderId}`,
        includeExternal: true,
      });
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (requestId=${event.payload.requestId}, serviceProviderId=${event.payload.serviceProviderId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async onStatusChanged(
    event: RequestStatusChangedEvent,
  ): Promise<void> {
    try {
      const {
        requestTitle,
        clientName,
        changedByUserId,
        toStatus,
        providerUserId,
        providerName,
        serviceProviderId,
      } = event.payload;

      // Use new field or fall back to deprecated
      const displayProviderName =
        providerName || event.payload.professionalName;
      const clientMadeChange = changedByUserId === event.payload.clientId;
      const statusLabel = this.statusLabel(toStatus);
      const requestRef = requestTitle ? `"${requestTitle}"` : 'la solicitud';

      // The author of a status change is never notified about their own action.
      if (!clientMadeChange) {
        await this.notifications.createForUser({
          userId: event.payload.clientId,
          type: 'REQUEST_STATUS_CHANGED',
          title: `${displayProviderName || 'El especialista'} movió ${requestRef} a "${statusLabel}"`,
          body: this.statusChangeBody(toStatus),
          data: {
            requestId: event.payload.requestId,
            fromStatus: event.payload.fromStatus,
            toStatus: event.payload.toStatus,
            serviceProviderId,
          },
          idempotencyKey: `${event.name}:${event.payload.requestId}:${event.payload.clientId}:${event.payload.fromStatus}->${event.payload.toStatus}`,
          includeExternal: true,
          requireExternal: true,
        });
      }

      // Use providerUserId directly if available, otherwise fall back to lookup (backward compat)
      const effectiveProviderUserId =
        providerUserId ||
        (event.payload.professionalId
          ? (
              await this.professionalService.getByIdOrFail(
                event.payload.professionalId,
              )
            ).userId
          : null);

      if (
        effectiveProviderUserId &&
        changedByUserId !== effectiveProviderUserId
      ) {
        await this.notifications.createForUser({
          userId: effectiveProviderUserId,
          type: 'REQUEST_STATUS_CHANGED',
          title: `${clientName} movió ${requestRef} a "${statusLabel}"`,
          body: this.statusChangeBody(toStatus),
          data: {
            requestId: event.payload.requestId,
            fromStatus: event.payload.fromStatus,
            toStatus: event.payload.toStatus,
            serviceProviderId,
          },
          idempotencyKey: `${event.name}:${event.payload.requestId}:${effectiveProviderUserId}:${event.payload.fromStatus}->${event.payload.toStatus}`,
          includeExternal: true,
          requireExternal: true,
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (requestId=${event.payload.requestId}, clientId=${event.payload.clientId}, from=${event.payload.fromStatus}, to=${event.payload.toStatus}, serviceProviderId=${event.payload.serviceProviderId ?? 'n/a'})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private statusLabel(status: RequestStatus): string {
    return REQUEST_STATUS_LABELS_ES[status] || status;
  }

  private statusChangeBody(status: RequestStatus): string {
    if (status === RequestStatus.IN_PROGRESS) {
      return 'El trabajo ha comenzado.';
    }
    if (status === RequestStatus.FINISHED) {
      return '¡El trabajo está completo! Confirmá que quedaste conforme.';
    }
    if (status === RequestStatus.CLOSED) {
      return '¡El pedido se cerró!';
    }
    if (status === RequestStatus.CANCELLED) {
      return 'La solicitud fue cancelada.';
    }
    return '';
  }
}
