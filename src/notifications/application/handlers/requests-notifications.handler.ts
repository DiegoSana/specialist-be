import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { NotificationService } from '../services/notification.service';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { ProfessionalEntity } from '../../../profiles/domain/entities/professional.entity';
import { UserService } from '../../../identity/application/services/user.service';
import {
  WHATSAPP_MESSAGING_PORT,
  WhatsAppMessagingPort,
} from '../../../shared/domain/ports/whatsapp-messaging.port';
import { MessageTemplateService } from '../../../shared/infrastructure/messaging/message-template.service';
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
    private readonly userService: UserService,
    @Inject(WHATSAPP_MESSAGING_PORT)
    private readonly whatsAppMessaging: WhatsAppMessagingPort,
    private readonly templateService: MessageTemplateService,
  ) {}

  onModuleInit(): void {
    // The current event bus is in-memory and exposes `.on(...)`.
    if (typeof this.eventBus?.on !== 'function') {
      this.logger.warn(
        'EventBus does not support subscriptions; notifications will not be generated from events.',
      );
      return;
    }

    this.eventBus.on(
      RequestCreatedEvent.EVENT_NAME,
      (event: RequestCreatedEvent) => this.onRequestCreated(event),
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

  // Fan out a "new matching request" notice to professionals who opted in via
  // notifyOnNewMatchingRequest, scoped to public requests with a trade. Matching is trade-only
  // by deliberate product decision (the app is scoped to Bariloche/Dina Huapi for now), so no
  // zone/city filtering is applied here.
  private async onRequestCreated(event: RequestCreatedEvent): Promise<void> {
    const { requestId, isPublic, tradeId } = event.payload;
    if (!isPublic || !tradeId) {
      return;
    }

    let professionals: ProfessionalEntity[];
    try {
      professionals = await this.professionalService.findByTradeId(tradeId);
    } catch (err) {
      this.logger.error(
        `Failed to look up professionals for trade ${tradeId} (requestId=${requestId})`,
        err instanceof Error ? err.stack : String(err),
      );
      return;
    }

    const matching = professionals.filter(
      (professional) =>
        professional.notifyOnNewMatchingRequest && professional.canOperate(),
    );

    for (const professional of matching) {
      try {
        const trade = professional.trades.find((t) => t.id === tradeId);
        const tradeName = trade?.name || 'tu rubro';

        await this.notifications.createForUser({
          userId: professional.userId,
          type: 'REQUEST_MATCHING_TRADE_CREATED',
          title: `Nuevo pedido de ${tradeName}`,
          body: `Hay un nuevo pedido de ${tradeName} en Specialist. Mirá los detalles.`,
          data: { requestId, tradeId },
          idempotencyKey: `${event.name}:${requestId}:${professional.userId}`,
          // In-app only here: the WhatsApp notice for this type is sent directly below,
          // bypassing the generic external-dispatch pipeline (see sendMatchingRequestWhatsApp).
          includeExternal: false,
        });

        await this.sendMatchingRequestWhatsApp(
          professional,
          tradeName,
          requestId,
        );
      } catch (err) {
        this.logger.error(
          `Failed notifying professional ${professional.id} about matching request ${requestId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  /**
   * Direct WhatsApp send for the "new matching request" notice.
   *
   * NotificationDispatchService.dispatchPending() only dispatches email today (its WhatsApp
   * branch is unimplemented, see notification-dispatch.service.ts). Rather than completing that
   * generic dispatcher (a bigger, unplanned change), this sends WhatsApp directly via
   * WhatsAppMessagingPort, the same port the Request follow-up pipeline uses. This is known,
   * approved tech debt: migrate to the generic dispatch pipeline once its WhatsApp branch lands.
   */
  private async sendMatchingRequestWhatsApp(
    professional: ProfessionalEntity,
    tradeName: string,
    requestId: string,
  ): Promise<void> {
    const user = await this.userService.findById(professional.userId);
    if (!user?.phone || !user.phoneVerified) {
      this.logger.debug(
        `Professional ${professional.id} has no verified phone, skipping WhatsApp notice for request ${requestId}`,
      );
      return;
    }
    if (user.whatsappOptedOut) {
      this.logger.debug(
        `Professional ${professional.id} opted out of WhatsApp, skipping notice for request ${requestId}`,
      );
      return;
    }

    const baseUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3001'
    ).replace(/\/$/, '');
    const link = `${baseUrl}/es/specialist/requests/${requestId}`;

    const message = await this.templateService.getTemplate(
      'notice_new_matching_request',
      'es',
      {
        nombre: user.firstName || 'especialista',
        rubro: tradeName,
        link,
      },
    );

    await this.whatsAppMessaging.sendMessage(user.phone, message);
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
      // System/support-made changes have no human "author" to name in the copy.
      const systemMadeChange =
        event.payload.changedByActorKind === 'SYSTEM' ||
        event.payload.changedByActorKind === 'SUPPORT';
      const statusLabel = this.statusLabel(toStatus);
      const requestRef = requestTitle ? `"${requestTitle}"` : 'la solicitud';

      // The author of a status change is never notified about their own action.
      if (!clientMadeChange) {
        await this.notifications.createForUser({
          userId: event.payload.clientId,
          type: 'REQUEST_STATUS_CHANGED',
          title: systemMadeChange
            ? `${requestRef} pasó a "${statusLabel}"`
            : `${displayProviderName || 'El especialista'} movió ${requestRef} a "${statusLabel}"`,
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
          title: systemMadeChange
            ? `${requestRef} pasó a "${statusLabel}"`
            : `${clientName} movió ${requestRef} a "${statusLabel}"`,
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
    if (status === RequestStatus.EXPIRED) {
      return 'Nadie fue elegido a tiempo. Podés volver a publicarla.';
    }
    if (status === RequestStatus.NO_RESPONSE) {
      return 'El especialista no respondió. Podés enviarla a otro o publicarla en la bolsa.';
    }
    if (status === RequestStatus.ABANDONED) {
      return 'No hubo respuestas tras el contacto. Podés volver a publicarla.';
    }
    return '';
  }
}
