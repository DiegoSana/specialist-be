import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import {
  RequestAttentionReason,
  RequestStatus,
  ResponseIntent,
} from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { RequestInteractionRespondedEvent } from '../../domain/events/request-interaction-responded.event';
import { RequestService } from '../services/request.service';
import { RequestInteractionService } from '../services/request-interaction.service';
import { RequestInterestService } from '../services/request-interest.service';
import { RequestAttentionService } from '../services/request-attention.service';
import { MessageTemplateService } from '../../../shared/infrastructure/messaging/message-template.service';
import {
  REQUEST_INTERACTION_REPOSITORY,
  RequestInteractionRepository,
} from '../../domain/repositories/request-interaction.repository';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';

/**
 * Handler for RequestInteractionRespondedEvent.
 * Updates Request status based on detected intent from WhatsApp responses.
 */
@Injectable()
export class RequestInteractionRespondedHandler implements OnModuleInit {
  private readonly logger = new Logger(RequestInteractionRespondedHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    private readonly requestService: RequestService,
    @Inject(REQUEST_INTERACTION_REPOSITORY)
    private readonly interactionRepository: RequestInteractionRepository,
    private readonly interactionService: RequestInteractionService,
    private readonly requestInterestService: RequestInterestService,
    private readonly attentionService: RequestAttentionService,
    private readonly templateService: MessageTemplateService,
    @Inject(forwardRef(() => ProfessionalService))
    private readonly professionalService: ProfessionalService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      `Initializing RequestInteractionRespondedHandler. EventBus type: ${typeof this.eventBus}`,
    );

    if (typeof this.eventBus?.on !== 'function') {
      this.logger.error(
        'EventBus does not support subscriptions; request status updates from interactions will not work.',
      );
      return;
    }

    this.eventBus.on(
      RequestInteractionRespondedEvent.EVENT_NAME,
      (event: RequestInteractionRespondedEvent) => {
        this.logger.log(
          `Event received: ${RequestInteractionRespondedEvent.EVENT_NAME}, RequestId=${event.payload.requestId}, Intent=${event.payload.responseIntent}`,
        );
        return this.handleInteractionResponded(event);
      },
    );

    this.logger.log(
      `Registered handler for event: ${RequestInteractionRespondedEvent.EVENT_NAME}`,
    );
  }

  private async handleInteractionResponded(
    event: RequestInteractionRespondedEvent,
  ): Promise<void> {
    const { requestId, responseContent } = event.payload;

    this.logger.log(
      `Processing interaction response for request ${requestId} with intent ${event.payload.responseIntent} ` +
        `(confidence=${event.payload.confidence}, viability=${event.payload.viability}, optOut=${event.payload.optOut}, escalate=${event.payload.escalate})`,
    );
    // escalate/viability=ABANDONED flagging happens upstream in
    // RequestInteractionService.processInboundMessage, right after classification —
    // see RequestAttentionService. This handler flags separately, for status-change
    // attempts that the classifier inferred but the actor isn't actually authorized to
    // make (see the two `attentionService.flag(...ESCALATED...)` calls below).

    try {
      const request = await this.requestService.findById(requestId);
      if (!request) {
        this.logger.warn(`Request ${requestId} not found`);
        return;
      }

      const interaction = await this.interactionRepository.findById(
        event.payload.interactionId,
      );
      if (!interaction) {
        this.logger.warn(
          `Interaction ${event.payload.interactionId} not found`,
        );
        return;
      }

      // Special case: client replying to "assign specialist" follow-up with a number (1, 2, 3...)
      if (
        interaction.direction === 'TO_CLIENT' &&
        interaction.messageTemplate ===
          'follow_up_pending_3_days_with_interests' &&
        request.status === RequestStatus.PENDING
      ) {
        const assigned = await this.tryAssignProviderByNumber(
          requestId,
          request.clientId,
          responseContent,
          interaction.metadata,
        );
        if (assigned) {
          await this.sendAssignConfirmationMessage(requestId);
          return;
        }
        // The client's reply didn't parse as a valid specialist selection. Falling
        // through to the standard intent->status mapping below would try to set this
        // PENDING request straight to ACCEPTED without ever assigning a provider —
        // RequestEntity.canChangeStatusBy correctly rejects that (ACCEPTED requires an
        // assignment, which only assignProvider() does), so it always failed silently.
        // Flag for a human instead of attempting a transition that can't succeed.
        await this.attentionService.flag(
          requestId,
          RequestAttentionReason.ESCALATED,
          `Cliente respondió algo que no se pudo interpretar como selección de especialista: "${responseContent}"`,
        );
        return;
      }

      // Standard flow: map intent to status change
      const newStatus = this.mapIntentToStatus(
        event.payload.responseIntent,
        request.status,
      );

      if (!newStatus) {
        this.logger.debug(
          `Intent ${event.payload.responseIntent} does not trigger status change for request ${requestId} (current: ${request.status})`,
        );
        return;
      }

      let context: any;
      if (interaction.direction === 'TO_PROVIDER') {
        const providerUserId = request.providerId
          ? await this.getProviderUserId(request.providerId)
          : null;
        context = {
          userId: providerUserId || request.clientId,
          serviceProviderId: request.providerId,
          isAdmin: false,
        };
      } else {
        context = {
          userId: request.clientId,
          serviceProviderId: null,
          isAdmin: false,
        };
      }

      try {
        await this.requestService.updateStatus(requestId, context, {
          status: newStatus,
        });
      } catch (statusError: any) {
        // The classifier inferred a status change, but the actor isn't authorized to
        // make it directly (e.g. a provider asking to cancel a request that's already
        // in progress — only the client/admin can cancel). That's the domain correctly
        // protecting an invariant, not something to retry — but silently dropping it
        // leaves a real request stuck with no one aware the person asked for something.
        // Flag it for a human instead of just logging and moving on.
        this.logger.warn(
          `Status change denied for request ${requestId} (${request.status} -> ${newStatus}, intent ${event.payload.responseIntent}): ${statusError.message}`,
        );
        await this.attentionService.flag(
          requestId,
          RequestAttentionReason.ESCALATED,
          `El sistema detectó intención de cambiar el estado a ${newStatus} (a partir de "${responseContent}") pero no está autorizado a hacerlo automáticamente — requiere revisión manual.`,
        );
        return;
      }

      this.logger.log(
        `Request ${requestId} status updated from ${request.status} to ${newStatus} based on intent ${event.payload.responseIntent}`,
      );

      await this.sendConfirmationMessage(
        requestId,
        newStatus,
        event.payload.responseIntent,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process interaction response for request ${requestId}`,
        error,
      );
    }
  }

  /**
   * Try to parse response as 1-based index and assign that provider.
   * Returns true if assignment was done.
   */
  private async tryAssignProviderByNumber(
    requestId: string,
    clientId: string,
    responseContent: string,
    metadata: unknown,
  ): Promise<boolean> {
    const ids = (metadata as any)?.interestedProviderIds as
      | string[]
      | undefined;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return false;
    }
    const index = this.parseOneBasedIndex(responseContent);
    if (index === null || index < 1 || index > ids.length) {
      this.logger.debug(
        `Assign by number: invalid index from "${responseContent}" (expected 1-${ids.length})`,
      );
      return false;
    }
    const serviceProviderId = ids[index - 1];
    try {
      const ctx = await this.requestInterestService.buildAuthContext(
        clientId,
        false,
      );
      await this.requestInterestService.assignProvider(
        requestId,
        ctx,
        serviceProviderId,
      );
      this.logger.log(
        `Assigned provider ${serviceProviderId} to request ${requestId} (client replied "${responseContent}")`,
      );
      return true;
    } catch (error: any) {
      this.logger.warn(
        `Failed to assign provider by number: request ${requestId}, index ${index}, error=${error.message}`,
      );
      return false;
    }
  }

  /** Parse message as 1-based index (e.g. "1", "2", "el 2", "numero 3"). */
  private parseOneBasedIndex(message: string): number | null {
    const trimmed = message.trim();
    const num = parseInt(trimmed, 10);
    if (!Number.isNaN(num) && String(num) === trimmed) {
      return num;
    }
    const lower = trimmed.toLowerCase();
    const match = lower.match(/(?:el|numero|número|opci[oó]n)\s*(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    const onlyNum = trimmed.replace(/\D/g, '');
    if (onlyNum.length > 0) {
      return parseInt(onlyNum, 10);
    }
    return null;
  }

  private async sendAssignConfirmationMessage(
    requestId: string,
  ): Promise<void> {
    try {
      const request = await this.requestService.findById(requestId);
      const title = request?.title || 'Tu solicitud';
      await this.interactionService.createFollowUp({
        requestId,
        direction: 'TO_CLIENT' as any,
        messageTemplate: 'status_update_assigned',
        scheduledFor: new Date(),
        metadata: { triggeredBy: 'assign_by_number' },
        templateVariables: { title },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send assign confirmation for request ${requestId}`,
        error,
      );
    }
  }

  /**
   * Map response intent to Request status change.
   * Returns null if no status change should occur.
   *
   * Note: The logic considers the context of the follow-up message.
   * For example, if a follow-up asks "¿Ya empezaste?" and user responds "si",
   * it should be treated as STARTED, not CONFIRMED.
   */
  private mapIntentToStatus(
    intent: ResponseIntent,
    currentStatus: RequestStatus,
  ): RequestStatus | null {
    switch (intent) {
      case ResponseIntent.CONFIRMED:
        // CONFIRMED can mean:
        // 1. Accepting a request (PENDING -> ACCEPTED)
        // 2. Confirming they started work (ACCEPTED -> IN_PROGRESS) - if context suggests it
        if (currentStatus === RequestStatus.PENDING) {
          return RequestStatus.ACCEPTED;
        }
        // If request is ACCEPTED and user confirms, they likely started
        // This handles cases where "si" is detected as CONFIRMED but context is "did you start?"
        if (currentStatus === RequestStatus.ACCEPTED) {
          this.logger.debug(
            `CONFIRMED intent for ACCEPTED request - treating as STARTED`,
          );
          return RequestStatus.IN_PROGRESS;
        }
        return null;

      case ResponseIntent.STARTED:
        // STARTED means work has begun
        if (currentStatus === RequestStatus.ACCEPTED) {
          return RequestStatus.IN_PROGRESS;
        }
        return null;

      case ResponseIntent.COMPLETED:
        // COMPLETED means work is done
        if (currentStatus === RequestStatus.IN_PROGRESS) {
          return RequestStatus.DONE;
        }
        return null;

      case ResponseIntent.CANCELLED:
        // CANCELLED can happen from any non-terminal state
        if (
          currentStatus !== RequestStatus.DONE &&
          currentStatus !== RequestStatus.CANCELLED
        ) {
          return RequestStatus.CANCELLED;
        }
        return null;

      case ResponseIntent.NEEDS_INFO:
      case ResponseIntent.UNKNOWN:
      default:
        // These don't trigger status changes
        return null;
    }
  }

  /**
   * Send a confirmation message via WhatsApp when status is updated.
   */
  private async sendConfirmationMessage(
    requestId: string,
    newStatus: RequestStatus,
    intent: ResponseIntent,
  ): Promise<void> {
    try {
      // Determine template based on status
      let template: string | null = null;
      let direction: 'TO_CLIENT' | 'TO_PROVIDER' = 'TO_PROVIDER';

      switch (newStatus) {
        case RequestStatus.ACCEPTED:
          template = 'status_update_confirmed';
          direction = 'TO_PROVIDER';
          break;
        case RequestStatus.IN_PROGRESS:
          template = 'status_update_started';
          direction = 'TO_PROVIDER';
          break;
        case RequestStatus.DONE:
          template = 'status_update_completed';
          direction = 'TO_PROVIDER';
          break;
        case RequestStatus.CANCELLED:
          template = 'status_update_cancelled';
          direction = 'TO_PROVIDER';
          break;
      }

      if (!template) {
        return; // No confirmation needed for this status
      }

      // Create status update interaction
      await this.interactionService.createFollowUp({
        requestId,
        direction: direction as any,
        messageTemplate: template,
        scheduledFor: new Date(),
        metadata: {
          triggeredBy: 'status_update',
          previousStatus: newStatus, // This will be set correctly in the handler
          intent,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send confirmation message for request ${requestId}`,
        error,
      );
      // Don't throw - confirmation is optional
    }
  }

  /**
   * Get the userId for a service provider.
   */
  private async getProviderUserId(
    serviceProviderId: string,
  ): Promise<string | null> {
    try {
      const professional =
        await this.professionalService.findByServiceProviderId(
          serviceProviderId,
        );
      if (professional) {
        return professional.userId;
      }

      const company =
        await this.companyService.findByServiceProviderId(serviceProviderId);
      if (company) {
        return company.userId;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to get provider userId for ${serviceProviderId}`,
        error,
      );
    }

    return null;
  }
}
