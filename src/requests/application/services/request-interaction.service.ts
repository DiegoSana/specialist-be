import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import {
  RequestInteractionRepository,
  REQUEST_INTERACTION_REPOSITORY,
} from '../../domain/repositories/request-interaction.repository';
import { RequestInteractionEntity } from '../../domain/entities/request-interaction.entity';
import {
  InteractionType,
  InteractionDirection,
  InteractionStatus,
} from '@prisma/client';
import {
  WHATSAPP_MESSAGING_PORT,
  WhatsAppMessagingPort,
} from '../../domain/ports/whatsapp-messaging.port';
import {
  REQUEST_REPOSITORY,
  RequestRepository,
} from '../../domain/repositories/request.repository';
import { UserService } from '../../../identity/application/services/user.service';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';
import { DetectResponseIntentUseCase } from '../use-cases/detect-response-intent.use-case';
import { ResponseIntent } from '@prisma/client';
import { MessageTemplateService } from '../../../shared/infrastructure/messaging/message-template.service';
import { randomUUID } from 'crypto';
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import { RequestInteractionRespondedEvent } from '../../domain/events/request-interaction-responded.event';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 60000; // 1 minute
const MAX_RETRY_DELAY_MS = 3600000; // 1 hour

@Injectable()
export class RequestInteractionService {
  private readonly logger = new Logger(RequestInteractionService.name);

  constructor(
    @Inject(REQUEST_INTERACTION_REPOSITORY)
    private readonly interactionRepository: RequestInteractionRepository,
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
    @Inject(WHATSAPP_MESSAGING_PORT)
    private readonly whatsAppMessaging: WhatsAppMessagingPort,
    private readonly userService: UserService,
    @Inject(forwardRef(() => ProfessionalService))
    private readonly professionalService: ProfessionalService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
    private readonly detectIntentUseCase: DetectResponseIntentUseCase,
    private readonly templateService: MessageTemplateService,
    @Inject(EVENT_BUS)
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Send a WhatsApp message for an interaction.
   * Updates the interaction status to SENT and stores the Twilio message SID.
   */
  async sendMessage(interactionId: string): Promise<void> {
    let interaction = await this.interactionRepository.findById(interactionId);

    if (!interaction) {
      throw new NotFoundException(
        `RequestInteraction with id ${interactionId} not found`,
      );
    }

    // Allow retrying failed messages that are scheduled for retry
    const isPending = interaction.isPending();
    const isFailedButRetryable = interaction.isFailed() && this.canRetry(interaction);
    
    if (!isPending && !isFailedButRetryable) {
      this.logger.warn(
        `Cannot send message: interaction ${interactionId} is not pending or retryable (status: ${interaction.status})`,
      );
      return;
    }

    // If it's a failed message being retried, reset status to PENDING
    if (isFailedButRetryable) {
      const metadata = interaction.metadata as any;
      const retryInteraction = new RequestInteractionEntity(
        interaction.id,
        interaction.requestId,
        interaction.interactionType,
        InteractionStatus.PENDING,
        interaction.direction,
        interaction.channel,
        interaction.messageTemplate,
        interaction.messageContent,
        interaction.responseContent,
        interaction.responseIntent,
        interaction.scheduledFor,
        null, // Reset sentAt
        interaction.deliveredAt,
        interaction.respondedAt,
        null, // Reset twilioMessageSid
        null, // Reset twilioStatus
        metadata,
        interaction.createdAt,
        new Date(),
      );
      await this.interactionRepository.save(retryInteraction);
      // Reload the interaction
      const reloaded = await this.interactionRepository.findById(interactionId);
      if (!reloaded) {
        throw new NotFoundException(`Interaction ${interactionId} not found after reset`);
      }
      interaction = reloaded;
    }

    // Get request to determine recipient phone number
    const request = await this.requestRepository.findById(interaction.requestId);
    if (!request) {
      throw new NotFoundException(
        `Request with id ${interaction.requestId} not found`,
      );
    }

    // Determine recipient phone number based on direction
    // TODO: Get phone from User or Professional/Company based on direction
    // For now, this is a placeholder - we'll need to fetch user/provider data
    const recipientPhone = await this.getRecipientPhone(request, interaction.direction);
    
    if (!recipientPhone) {
      this.logger.warn(
        `Cannot send message: recipient phone not found for interaction ${interactionId}`,
      );
      const failedInteraction = interaction.markAsFailed();
      await this.interactionRepository.save(failedInteraction);
      return;
    }

    try {
      // Send message via WhatsApp messaging port
      const { messageId } = await this.whatsAppMessaging.sendMessage(
        recipientPhone,
        interaction.messageContent,
      );

      // Store recipientPhone in metadata for matching inbound messages
      const updatedMetadata = {
        ...(interaction.metadata || {}),
        recipientPhone,
        sentAt: new Date().toISOString(),
      };

      // Update interaction status and metadata
      const sentInteraction = interaction.markAsSent(messageId);
      // Create new entity with updated metadata
      const sentInteractionWithMetadata = new RequestInteractionEntity(
        sentInteraction.id,
        sentInteraction.requestId,
        sentInteraction.interactionType,
        sentInteraction.status,
        sentInteraction.direction,
        sentInteraction.channel,
        sentInteraction.messageTemplate,
        sentInteraction.messageContent,
        sentInteraction.responseContent,
        sentInteraction.responseIntent,
        sentInteraction.scheduledFor,
        sentInteraction.sentAt,
        sentInteraction.deliveredAt,
        sentInteraction.respondedAt,
        sentInteraction.twilioMessageSid,
        sentInteraction.twilioStatus,
        updatedMetadata,
        sentInteraction.createdAt,
        sentInteraction.updatedAt,
      );

      await this.interactionRepository.save(sentInteractionWithMetadata);

      this.logger.log(
        `WhatsApp message sent for interaction ${interactionId}, Message ID: ${messageId}, Recipient: ${recipientPhone}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send WhatsApp message for interaction ${interactionId}`,
        error,
      );

      // Check if we should retry
      const retryCount = this.getRetryCount(interaction);
      const shouldRetry = this.shouldRetry(error, retryCount);

      if (shouldRetry) {
        // Calculate next retry time with exponential backoff
        const nextRetryDelay = this.calculateRetryDelay(retryCount);
        const nextRetryAt = new Date(Date.now() + nextRetryDelay);

        const updatedMetadata = {
          ...(interaction.metadata || {}),
          retryCount: retryCount + 1,
          lastRetryAttempt: new Date().toISOString(),
          nextRetryAt: nextRetryAt.toISOString(),
          lastError: error.message || 'Unknown error',
        };

        // Keep as PENDING but update metadata with retry info
        const retryInteraction = new RequestInteractionEntity(
          interaction.id,
          interaction.requestId,
          interaction.interactionType,
          interaction.status, // Keep as PENDING
          interaction.direction,
          interaction.channel,
          interaction.messageTemplate,
          interaction.messageContent,
          interaction.responseContent,
          interaction.responseIntent,
          nextRetryAt, // Update scheduledFor to next retry time
          interaction.sentAt,
          interaction.deliveredAt,
          interaction.respondedAt,
          interaction.twilioMessageSid,
          interaction.twilioStatus,
          updatedMetadata,
          interaction.createdAt,
          new Date(),
        );

        await this.interactionRepository.save(retryInteraction);

        this.logger.warn(
          `Message send failed for interaction ${interactionId}, will retry ${retryCount + 1}/${MAX_RETRIES} at ${nextRetryAt.toISOString()}`,
        );
      } else {
        // Max retries reached or non-retryable error - mark as failed
        const failedMetadata = {
          ...(interaction.metadata || {}),
          retryCount: retryCount + 1,
          lastRetryAttempt: new Date().toISOString(),
          lastError: error.message || 'Unknown error',
          failedAt: new Date().toISOString(),
        };

        const failedInteraction = interaction.markAsFailed();
        const failedInteractionWithMetadata = new RequestInteractionEntity(
          failedInteraction.id,
          failedInteraction.requestId,
          failedInteraction.interactionType,
          failedInteraction.status,
          failedInteraction.direction,
          failedInteraction.channel,
          failedInteraction.messageTemplate,
          failedInteraction.messageContent,
          failedInteraction.responseContent,
          failedInteraction.responseIntent,
          failedInteraction.scheduledFor,
          failedInteraction.sentAt,
          failedInteraction.deliveredAt,
          failedInteraction.respondedAt,
          failedInteraction.twilioMessageSid,
          failedInteraction.twilioStatus,
          failedMetadata,
          failedInteraction.createdAt,
          new Date(),
        );

        await this.interactionRepository.save(failedInteractionWithMetadata);

        this.logger.error(
          `Message send failed permanently for interaction ${interactionId} after ${retryCount + 1} attempts`,
        );
      }

      // Don't throw - we've handled the error
    }
  }

  /**
   * Get retry count from interaction metadata.
   */
  private getRetryCount(interaction: RequestInteractionEntity): number {
    const metadata = interaction.metadata as any;
    return metadata?.retryCount || 0;
  }

  /**
   * Check if a failed interaction can be retried.
   */
  private canRetry(interaction: RequestInteractionEntity): boolean {
    if (!interaction.isFailed()) {
      return false;
    }

    const metadata = interaction.metadata as any;
    const retryCount = metadata?.retryCount || 0;
    const nextRetryAt = metadata?.nextRetryAt;

    // Can retry if we haven't exceeded max retries and nextRetryAt is in the past
    if (retryCount >= MAX_RETRIES) {
      return false;
    }

    if (nextRetryAt) {
      const nextRetryDate = new Date(nextRetryAt);
      return nextRetryDate <= new Date();
    }

    return false;
  }

  /**
   * Determine if an error should be retried.
   * Some errors (like invalid phone number) should not be retried.
   */
  private shouldRetry(error: any, retryCount: number): boolean {
    // Don't retry if max retries reached
    if (retryCount >= MAX_RETRIES) {
      return false;
    }

    // Don't retry on certain error types
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';

    // Invalid phone number - don't retry
    if (
      errorMessage.includes('invalid') &&
      (errorMessage.includes('phone') || errorMessage.includes('number'))
    ) {
      return false;
    }

    // Rate limit errors - retry with backoff
    if (errorCode === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
      return true;
    }

    // Network/timeout errors - retry
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('econnrefused') ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT'
    ) {
      return true;
    }

    // Twilio API errors - retry transient errors
    if (error.status === 429 || error.status === 500 || error.status === 503) {
      return true;
    }

    // Default: retry for unknown errors
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff.
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
    return Math.min(delay, MAX_RETRY_DELAY_MS);
  }

  /**
   * Get recipient phone number based on interaction direction.
   */
  private async getRecipientPhone(
    request: any,
    direction: InteractionDirection,
  ): Promise<string | null> {
    if (direction === InteractionDirection.TO_CLIENT) {
      // Get client's phone
      const user = await this.userService.findById(request.clientId);
      if (!user || !user.phone || !user.phoneVerified) {
        this.logger.warn(
          `Client ${request.clientId} does not have verified phone number`,
        );
        return null;
      }
      return user.phone;
    } else {
      // Get provider's phone/whatsapp
      if (!request.providerId) {
        this.logger.warn(
          `Request ${request.id} does not have a provider assigned`,
        );
        return null;
      }

      // Try to get professional first (contact phone = user.phone)
      try {
        const professional =
          await this.professionalService.findByServiceProviderId(
            request.providerId,
          );
        if (professional) {
          const user = await this.userService.findById(professional.userId);
          if (user?.phone && user.phoneVerified) {
            return user.phone;
          }
        }
      } catch (error) {
        // Professional not found, try company
      }

      // Try to get company (contact phone = user.phone)
      try {
        const company = await this.companyService.findByServiceProviderId(
          request.providerId,
        );
        if (company) {
          const user = await this.userService.findById(company.userId);
          if (user?.phone && user.phoneVerified) {
            return user.phone;
          }
        }
      } catch (error) {
        this.logger.warn(
          `Provider ${request.providerId} not found as professional or company`,
        );
      }

      return null;
    }
  }

  /**
   * Mark an interaction as delivered based on Twilio status update.
   * Idempotent: If the same status update is received multiple times, it will only be processed once.
   */
  async markAsDelivered(
    messageId: string,
    twilioStatus: string,
  ): Promise<void> {
    const interaction =
      await this.interactionRepository.findByTwilioMessageSid(messageId);

    if (!interaction) {
      this.logger.warn(
        `Interaction not found for Twilio message ID: ${messageId}`,
      );
      return;
    }

    // Idempotency check: If we already have this status, skip processing
    if (interaction.twilioStatus === twilioStatus) {
      this.logger.debug(
        `Status update already processed: MessageId=${messageId}, Status=${twilioStatus}, InteractionId=${interaction.id}`,
      );
      return;
    }

    if (!interaction.isSent()) {
      this.logger.warn(
        `Cannot mark as delivered: interaction ${interaction.id} is not sent (status: ${interaction.status})`,
      );
      return;
    }

    // Handle different Twilio statuses
    if (twilioStatus === 'delivered' || twilioStatus === 'read') {
      // Successfully delivered
      const deliveredInteraction = interaction.markAsDelivered(
        twilioStatus,
      );
      await this.interactionRepository.save(deliveredInteraction);

      this.logger.log(
        `Interaction ${interaction.id} marked as delivered (status: ${twilioStatus})`,
      );
    } else if (
      twilioStatus === 'failed' ||
      twilioStatus === 'undelivered' ||
      twilioStatus === 'canceled'
    ) {
      // Message failed - mark as failed and log error
      const metadata = {
        ...(interaction.metadata || {}),
        lastStatusUpdate: twilioStatus,
        lastStatusUpdateAt: new Date().toISOString(),
        twilioError: twilioStatus,
        failedAt: new Date().toISOString(),
      };

      const failedInteraction = interaction.markAsFailed();
      const failedInteractionWithMetadata = new RequestInteractionEntity(
        failedInteraction.id,
        failedInteraction.requestId,
        failedInteraction.interactionType,
        failedInteraction.status,
        failedInteraction.direction,
        failedInteraction.channel,
        failedInteraction.messageTemplate,
        failedInteraction.messageContent,
        failedInteraction.responseContent,
        failedInteraction.responseIntent,
        failedInteraction.scheduledFor,
        failedInteraction.sentAt,
        failedInteraction.deliveredAt,
        failedInteraction.respondedAt,
        failedInteraction.twilioMessageSid,
        twilioStatus,
        metadata,
        failedInteraction.createdAt,
        new Date(),
      );

      await this.interactionRepository.save(failedInteractionWithMetadata);

      this.logger.error(
        `Interaction ${interaction.id} marked as FAILED due to Twilio status: ${twilioStatus}`,
      );
    } else {
      // Other statuses (queued, sending, etc.) - just update metadata
      const metadata = {
        ...(interaction.metadata || {}),
        lastStatusUpdate: twilioStatus,
        lastStatusUpdateAt: new Date().toISOString(),
      };

      const updatedInteraction = new RequestInteractionEntity(
        interaction.id,
        interaction.requestId,
        interaction.interactionType,
        interaction.status,
        interaction.direction,
        interaction.channel,
        interaction.messageTemplate,
        interaction.messageContent,
        interaction.responseContent,
        interaction.responseIntent,
        interaction.scheduledFor,
        interaction.sentAt,
        interaction.deliveredAt,
        interaction.respondedAt,
        interaction.twilioMessageSid,
        twilioStatus,
        metadata,
        interaction.createdAt,
        new Date(),
      );

      await this.interactionRepository.save(updatedInteraction);

      this.logger.debug(
        `Status updated for interaction ${interaction.id}: ${twilioStatus}`,
      );
    }
  }

  /**
   * Process an inbound WhatsApp message.
   * Finds the related interaction and updates it with the response.
   * Idempotent: If the same inbound message is received multiple times, it will only be processed once.
   */
  async processInboundMessage(params: {
    from: string;
    body: string;
    messageId: string;
  }): Promise<void> {
    // Extract phone number from Twilio format (whatsapp:+5492944123456 -> +5492944123456)
    const phoneNumber = params.from.replace('whatsapp:', '');

    this.logger.log(
      `Processing inbound message: MessageId=${params.messageId}, From=${phoneNumber}, Preview="${params.body.substring(0, 50)}..."`,
    );

    // Idempotency check: Try to find if we already processed this inbound message
    // We check by looking for an interaction that has this MessageId stored in metadata
    const existingInteraction =
      await this.interactionRepository.findByTwilioMessageSid(params.messageId);
    
    if (existingInteraction && existingInteraction.isResponded()) {
      // Check if this is the same inbound message we already processed
      const metadata = existingInteraction.metadata as any;
      if (metadata?.inboundMessageSid === params.messageId) {
        this.logger.debug(
          `Inbound message already processed: MessageId=${params.messageId}, InteractionId=${existingInteraction.id}`,
        );
        return;
      }
    }

    // Try multiple strategies to find the matching interaction
    
    // Strategy 1: Find by Twilio message SID (if this is a status update or reply)
    let interaction =
      await this.interactionRepository.findByTwilioMessageSid(params.messageId);

    // Strategy 2: Find by phone number in metadata (most recent pending/delivered)
    if (!interaction) {
      interaction =
        await this.interactionRepository.findMostRecentByPhone(phoneNumber);
    }

    if (!interaction) {
      this.logger.warn(
        `Could not match inbound message to an interaction: Phone=${phoneNumber}, MessageId=${params.messageId}`,
      );
      return;
    }

    // Idempotency check: If this interaction already has a response with the same content
    if (interaction.isResponded()) {
      // Check if it's the same message
      const metadata = interaction.metadata as any;
      if (metadata?.inboundMessageSid === params.messageId) {
        this.logger.debug(
          `Inbound message already processed: MessageId=${params.messageId}, InteractionId=${interaction.id}`,
        );
        return;
      }
      
      // If it's a different message but already responded, log and skip
      this.logger.warn(
        `Interaction ${interaction.id} already has a response, skipping duplicate inbound message`,
      );
      return;
    }

    // Only process if interaction is in a state that can receive responses
    if (!interaction.isDelivered() && !interaction.isSent()) {
      this.logger.warn(
        `Interaction ${interaction.id} is not in a state to receive responses (status: ${interaction.status})`,
      );
      return;
    }

    // Detect intent from message text
    const intent = this.detectIntentUseCase.detectIntent(params.body);
    
    // Mark interaction as responded and store inbound message SID for idempotency
    const respondedInteraction = interaction.markAsResponded(
      params.body,
      intent,
    );
    
    // Add inbound message SID to metadata for idempotency tracking
    const metadata = {
      ...(interaction.metadata || {}),
      inboundMessageSid: params.messageId,
      inboundMessageProcessedAt: new Date().toISOString(),
    };

    const respondedInteractionWithMetadata = new RequestInteractionEntity(
      respondedInteraction.id,
      respondedInteraction.requestId,
      respondedInteraction.interactionType,
      respondedInteraction.status,
      respondedInteraction.direction,
      respondedInteraction.channel,
      respondedInteraction.messageTemplate,
      respondedInteraction.messageContent,
      respondedInteraction.responseContent,
      respondedInteraction.responseIntent,
      respondedInteraction.scheduledFor,
      respondedInteraction.sentAt,
      respondedInteraction.deliveredAt,
      respondedInteraction.respondedAt,
      respondedInteraction.twilioMessageSid,
      respondedInteraction.twilioStatus,
      metadata,
      respondedInteraction.createdAt,
      new Date(),
    );
    
    await this.interactionRepository.save(respondedInteractionWithMetadata);

    // Calculate response time
    const responseTimeMinutes = interaction.sentAt
      ? Math.round(
          (respondedInteraction.respondedAt.getTime() -
            interaction.sentAt.getTime()) /
            (1000 * 60),
        )
      : undefined;

    this.logger.log(
      `Interaction ${interaction.id} marked as responded with intent: ${intent}`,
    );

    // Emit event for handlers to process (e.g., update Request status)
    const event = new RequestInteractionRespondedEvent({
      interactionId: interaction.id,
      requestId: interaction.requestId,
      responseContent: params.body,
      responseIntent: intent,
      respondedAt: respondedInteraction.respondedAt,
      responseTimeMinutes,
    });

    this.logger.log(
      `Publishing event: ${event.name}, RequestId=${event.payload.requestId}, Intent=${event.payload.responseIntent}`,
    );

    await this.eventBus.publish(event);

    this.logger.debug(`Event published successfully: ${event.name}`);
  }

  /**
   * Create a follow-up interaction with a template message.
   */
  async createFollowUp(params: {
    requestId: string;
    direction: InteractionDirection;
    messageTemplate: string;
    scheduledFor: Date;
    metadata?: Record<string, unknown>;
  }): Promise<RequestInteractionEntity> {
    const request = await this.requestRepository.findById(params.requestId);
    if (!request) {
      throw new NotFoundException(
        `Request with id ${params.requestId} not found`,
      );
    }

    // Get template message with request title
    const messageContent = await this.templateService.getTemplate(
      params.messageTemplate,
      'es', // TODO: Get language from user preferences
      {
        title: request.title || 'Tu solicitud',
      },
    );

    // Create interaction
    const interaction = RequestInteractionEntity.createPending({
      id: randomUUID(),
      requestId: params.requestId,
      interactionType: InteractionType.FOLLOW_UP,
      direction: params.direction,
      channel: 'WHATSAPP',
      messageTemplate: params.messageTemplate,
      messageContent,
      scheduledFor: params.scheduledFor,
      metadata: params.metadata,
    });

    return await this.interactionRepository.save(interaction);
  }
}

