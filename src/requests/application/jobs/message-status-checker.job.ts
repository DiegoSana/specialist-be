import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  REQUEST_INTERACTION_REPOSITORY,
  RequestInteractionRepository,
} from '../../domain/repositories/request-interaction.repository';
import { TwilioClientService } from '../../../shared/infrastructure/messaging/twilio-client.service';
import { RequestInteractionService } from '../services/request-interaction.service';

/**
 * Cron job that checks the status of sent messages in Twilio.
 * This helps detect external errors (e.g., Twilio rejected the message)
 * that weren't caught during the initial send.
 * 
 * Runs every 5 minutes to check messages that were sent but not yet delivered.
 */
@Injectable()
export class MessageStatusCheckerJob {
  private readonly logger = new Logger(MessageStatusCheckerJob.name);
  private readonly enabled: boolean;

  constructor(
    @Inject(REQUEST_INTERACTION_REPOSITORY)
    private readonly interactionRepository: RequestInteractionRepository,
    private readonly twilioClientService: TwilioClientService,
    private readonly interactionService: RequestInteractionService,
    private readonly config: ConfigService,
  ) {
    this.enabled =
      this.config.get<string>('WHATSAPP_STATUS_CHECK_ENABLED', 'false') ===
      'true';
  }

  /**
   * Run every 5 minutes to check message statuses.
   * Format: second minute hour day month dayOfWeek
   */
  @Cron('*/5 * * * *')
  async checkMessageStatuses(): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Message status checker is disabled');
      return;
    }

    if (!this.twilioClientService.isInitialized()) {
      this.logger.debug('Twilio client not initialized, skipping status check');
      return;
    }

    const startTime = Date.now();
    this.logger.debug('Starting message status check job');

    try {
      const twilioClient = this.twilioClientService.getClient();
      if (!twilioClient) {
        return;
      }

      // Find interactions that are SENT but not DELIVERED
      // Check messages sent in the last hour (to avoid checking very old messages)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const interactionsToCheck =
        await this.interactionRepository.findSentButNotDelivered(oneHourAgo);

      if (interactionsToCheck.length === 0) {
        this.logger.debug('No sent interactions to check');
        return;
      }

      this.logger.log(
        `Checking status of ${interactionsToCheck.length} sent messages`,
      );

      let checked = 0;
      let failed = 0;
      let delivered = 0;

      for (const interaction of interactionsToCheck) {
        if (!interaction.twilioMessageSid) continue;

        try {
          // Fetch message status from Twilio
          const message = await twilioClient.messages(
            interaction.twilioMessageSid,
          ).fetch();

          checked++;

          // Update interaction based on Twilio status
          if (message.status === 'delivered' || message.status === 'read') {
            delivered++;
            // Mark as delivered (this will be handled by webhook, but we check here as backup)
            this.logger.debug(
              `Message ${interaction.twilioMessageSid} is delivered`,
            );
          } else if (
            message.status === 'failed' ||
            message.status === 'undelivered' ||
            message.status === 'canceled'
          ) {
            failed++;
            this.logger.warn(
              `Message ${interaction.twilioMessageSid} failed in Twilio: ${message.status} (Error: ${message.errorCode || 'N/A'} - ${message.errorMessage || 'N/A'})`,
            );
            
            // Update interaction status via webhook handler (which handles failed status)
            await this.interactionService.markAsDelivered(
              interaction.twilioMessageSid!,
              message.status,
            );
          } else {
            this.logger.debug(
              `Message ${interaction.twilioMessageSid} status: ${message.status}`,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `Failed to check status for message ${interaction.twilioMessageSid}`,
            error.message,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Message status check completed: Checked=${checked}, Delivered=${delivered}, Failed=${failed}, Duration=${duration}ms`,
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Message status check job failed: Error=${error.message}, Duration=${duration}ms`,
        error.stack,
      );
    }
  }
}

