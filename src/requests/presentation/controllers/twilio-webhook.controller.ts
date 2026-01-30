import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { RequestInteractionService } from '../../application/services/request-interaction.service';
import { TwilioWebhookDto } from '../dto/twilio-webhook.dto';
import { TwilioWebhookGuard } from '../guards/twilio-webhook.guard';
import { TwilioRateLimitGuard } from '../guards/twilio-rate-limit.guard';

/**
 * Controller for receiving Twilio webhooks.
 * Handles both status updates and inbound messages.
 */
@Controller('webhooks/twilio')
@UseGuards(TwilioWebhookGuard, TwilioRateLimitGuard)
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(
    private readonly interactionService: RequestInteractionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any, // Changed to any temporarily to avoid validation issues
    @Headers() headers: Record<string, string>,
  ): Promise<{ message: string }> {
    this.logger.log(`🔔 Webhook endpoint called! Body type: ${typeof body}, Body keys: ${Object.keys(body || {}).join(', ')}`);
    this.logger.log(`🔔 Raw body: ${JSON.stringify(body)}`);
    
    const webhookId = body?.MessageSid || 'unknown';
    const startTime = Date.now();
    const webhookType = this.determineWebhookType(body);

    this.logger.log(
      `Received Twilio webhook: MessageSid=${webhookId}, Type=${webhookType}, Body keys=${Object.keys(body || {}).join(',')}`,
    );
    
    // Log full body for debugging inbound messages
    if (webhookType === 'INBOUND_MESSAGE') {
      this.logger.debug(
        `Inbound message details: From=${body.From}, Body="${body.Body}", MessageSid=${body.MessageSid}`,
      );
    }

    try {
      // Determine webhook type
      if (body.MessageSid && body.MessageStatus) {
        // Status update webhook
        await this.handleStatusUpdate(body);
      } else if (body.MessageSid && body.Body) {
        // Inbound message webhook
        await this.handleInboundMessage(body);
      } else {
        this.logger.warn(
          `Unknown webhook type received: MessageSid=${webhookId}, Body keys=${Object.keys(body).join(',')}`,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Webhook processed successfully: MessageSid=${webhookId}, Duration=${duration}ms`,
      );

      return { message: 'OK' };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to process webhook: MessageSid=${webhookId}, Duration=${duration}ms, Error=${error.message}`,
        error.stack,
      );
      
      // Re-throw to let NestJS handle it (will return 500)
      throw error;
    }
  }

  private determineWebhookType(body: TwilioWebhookDto): string {
    if (body.MessageSid && body.MessageStatus) {
      return 'STATUS_UPDATE';
    }
    if (body.MessageSid && body.Body) {
      return 'INBOUND_MESSAGE';
    }
    return 'UNKNOWN';
  }

  private async handleStatusUpdate(body: TwilioWebhookDto): Promise<void> {
    if (!body.MessageSid || !body.MessageStatus) {
      this.logger.warn(
        `Incomplete status update: MessageSid=${body.MessageSid}, Status=${body.MessageStatus}`,
      );
      return;
    }

    const startTime = Date.now();
    this.logger.debug(
      `Processing status update: MessageSid=${body.MessageSid}, Status=${body.MessageStatus}`,
    );

    try {
      // Service handles idempotency internally
      await this.interactionService.markAsDelivered(
        body.MessageSid,
        body.MessageStatus,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Status update processed: MessageSid=${body.MessageSid}, Status=${body.MessageStatus}, Duration=${duration}ms`,
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Check if error is due to idempotency (already processed)
      if (error.message?.includes('already processed')) {
        this.logger.debug(
          `Status update already processed (idempotent): MessageSid=${body.MessageSid}, Status=${body.MessageStatus}, Duration=${duration}ms`,
        );
        return;
      }
      
      this.logger.error(
        `Failed to process status update: MessageSid=${body.MessageSid}, Status=${body.MessageStatus}, Duration=${duration}ms, Error=${error.message}`,
        error.stack,
      );
      // Don't throw - we want to return 200 to Twilio even if processing fails
      // This prevents Twilio from retrying indefinitely
    }
  }

  private async handleInboundMessage(body: TwilioWebhookDto): Promise<void> {
    if (!body.MessageSid || !body.From || !body.Body) {
      this.logger.warn(
        `Incomplete inbound message: MessageSid=${body.MessageSid}, From=${body.From}, HasBody=${!!body.Body}`,
      );
      return;
    }

    const startTime = Date.now();
    const phoneNumber = body.From;
    const messagePreview = body.Body.substring(0, 50);

    this.logger.log(
      `Processing inbound message: MessageSid=${body.MessageSid}, From=${phoneNumber}, Preview="${messagePreview}..."`,
    );

    try {
      // Service handles idempotency internally
      await this.interactionService.processInboundMessage({
        from: phoneNumber,
        body: body.Body,
        messageId: body.MessageSid,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Inbound message processed: MessageSid=${body.MessageSid}, From=${phoneNumber}, Duration=${duration}ms`,
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Check if error is due to idempotency (already processed)
      if (error.message?.includes('already processed')) {
        this.logger.debug(
          `Inbound message already processed (idempotent): MessageSid=${body.MessageSid}, From=${phoneNumber}, Duration=${duration}ms`,
        );
        return;
      }
      
      this.logger.error(
        `Failed to process inbound message: MessageSid=${body.MessageSid}, From=${phoneNumber}, Duration=${duration}ms, Error=${error.message}`,
        error.stack,
      );
      // Don't throw - we want to return 200 to Twilio even if processing fails
      // This prevents Twilio from retrying indefinitely
    }
  }
}

