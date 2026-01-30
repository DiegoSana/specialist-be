import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RequestInteractionService } from '../services/request-interaction.service';
import {
  REQUEST_INTERACTION_REPOSITORY,
  RequestInteractionRepository,
} from '../../domain/repositories/request-interaction.repository';

/**
 * Cron job that dispatches pending WhatsApp messages.
 * Runs every minute to check for interactions that need to be sent.
 */
@Injectable()
export class WhatsAppDispatchJob {
  private readonly logger = new Logger(WhatsAppDispatchJob.name);

  constructor(
    @Inject(REQUEST_INTERACTION_REPOSITORY)
    private readonly interactionRepository: RequestInteractionRepository,
    private readonly interactionService: RequestInteractionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Run every minute to dispatch pending WhatsApp messages.
   * Format: second minute hour day month dayOfWeek
   */
  @Cron('*/1 * * * *')
  async dispatchPendingMessages(): Promise<void> {
    const startTime = Date.now();
    const enabled = this.config.get<string>(
      'WHATSAPP_FOLLOWUP_ENABLED',
      'false',
    );

    if (enabled !== 'true') {
      this.logger.debug('WhatsApp follow-ups are disabled');
      return;
    }

    this.logger.debug('Starting WhatsApp dispatch job');

    try {
      const now = new Date();
      
      // Get pending interactions
      const pendingInteractions =
        await this.interactionRepository.findPendingFollowUps(now);

      // Get failed interactions that are ready for retry
      const retryableInteractions =
        await this.interactionRepository.findFailedRetryable(now);

      const totalInteractions = pendingInteractions.length + retryableInteractions.length;

      if (totalInteractions === 0) {
        this.logger.debug('No pending or retryable interactions to dispatch');
        return;
      }

      this.logger.log(
        `Dispatching messages: Pending=${pendingInteractions.length}, Retryable=${retryableInteractions.length}, Total=${totalInteractions}`,
      );

      let successCount = 0;
      let failureCount = 0;

      // Process pending interactions
      for (const interaction of pendingInteractions) {
        try {
          await this.interactionService.sendMessage(interaction.id);
          successCount++;
        } catch (error: any) {
          failureCount++;
          this.logger.error(
            `Failed to send message: InteractionId=${interaction.id}, RequestId=${interaction.requestId}, Error=${error.message}`,
            error.stack,
          );
        }
      }

      // Process retryable failed interactions
      for (const interaction of retryableInteractions) {
        try {
          await this.interactionService.sendMessage(interaction.id);
          successCount++;
        } catch (error: any) {
          failureCount++;
          this.logger.error(
            `Failed to retry message: InteractionId=${interaction.id}, RequestId=${interaction.requestId}, RetryCount=${(interaction.metadata as any)?.retryCount || 0}, Error=${error.message}`,
            error.stack,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `WhatsApp dispatch job completed: Success=${successCount}, Failed=${failureCount}, Duration=${duration}ms`,
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `WhatsApp dispatch job failed: Error=${error.message}, Duration=${duration}ms`,
        error.stack,
      );
      // Don't throw - we want the job to continue running on next schedule
    }
  }
}

