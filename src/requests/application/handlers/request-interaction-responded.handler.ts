import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { RequestStatus, ResponseIntent } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { RequestInteractionRespondedEvent } from '../../domain/events/request-interaction-responded.event';
import { RequestService } from '../services/request.service';
import { RequestInteractionService } from '../services/request-interaction.service';
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
  private readonly logger = new Logger(
    RequestInteractionRespondedHandler.name,
  );

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    private readonly requestService: RequestService,
    @Inject(REQUEST_INTERACTION_REPOSITORY)
    private readonly interactionRepository: RequestInteractionRepository,
    private readonly interactionService: RequestInteractionService,
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
    const { requestId, responseIntent } = event.payload;

    this.logger.log(
      `Processing interaction response for request ${requestId} with intent: ${responseIntent}`,
    );

    try {
      // Get the request
      const request = await this.requestService.findById(requestId);
      if (!request) {
        this.logger.warn(`Request ${requestId} not found`);
        return;
      }

      // Determine new status based on intent
      const newStatus = this.mapIntentToStatus(
        responseIntent,
        request.status,
      );

      if (!newStatus) {
        this.logger.debug(
          `Intent ${responseIntent} does not trigger status change for request ${requestId} (current: ${request.status})`,
        );
        return;
      }

      // Determine who should be the actor based on the direction of the interaction
      // For TO_PROVIDER interactions, the provider is responding
      // For TO_CLIENT interactions, the client is responding
      const interaction = await this.interactionRepository.findById(
        event.payload.interactionId,
      );

      if (!interaction) {
        this.logger.warn(
          `Interaction ${event.payload.interactionId} not found`,
        );
        return;
      }

      // Create context based on interaction direction
      let context: any;
      if (interaction.direction === 'TO_PROVIDER') {
        // Provider is responding, so provider should be the actor
        const providerUserId = request.providerId
          ? await this.getProviderUserId(request.providerId)
          : null;
        context = {
          userId: providerUserId || request.clientId,
          serviceProviderId: request.providerId,
          isAdmin: false,
        };
      } else {
        // Client is responding
        context = {
          userId: request.clientId,
          serviceProviderId: null,
          isAdmin: false,
        };
      }

      // Update request status
      await this.requestService.updateStatus(requestId, context, {
        status: newStatus,
      });

      this.logger.log(
        `Request ${requestId} status updated from ${request.status} to ${newStatus} based on intent ${responseIntent}`,
      );

      // Optionally send confirmation message
      await this.sendConfirmationMessage(requestId, newStatus, responseIntent);
    } catch (error) {
      this.logger.error(
        `Failed to process interaction response for request ${requestId}`,
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

      const company = await this.companyService.findByServiceProviderId(
        serviceProviderId,
      );
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

