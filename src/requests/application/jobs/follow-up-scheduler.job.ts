import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RequestStatus, InteractionDirection } from '@prisma/client';
import {
  REQUEST_REPOSITORY,
  RequestRepository,
} from '../../domain/repositories/request.repository';
import {
  REQUEST_INTERACTION_REPOSITORY,
  RequestInteractionRepository,
} from '../../domain/repositories/request-interaction.repository';
import { RequestInteractionService } from '../services/request-interaction.service';
import { UserService } from '../../../identity/application/services/user.service';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';

/**
 * Cron job that schedules follow-up interactions for requests.
 * Runs every hour to check for requests that need follow-ups based on time rules.
 */
@Injectable()
export class FollowUpSchedulerJob {
  private readonly logger = new Logger(FollowUpSchedulerJob.name);

  // Configurable follow-up rules (in days)
  private readonly followUpRules = {
    ACCEPTED_3_DAYS: {
      status: RequestStatus.ACCEPTED,
      days: 3,
      template: 'follow_up_3_days',
      direction: InteractionDirection.TO_PROVIDER,
    },
    ACCEPTED_7_DAYS: {
      status: RequestStatus.ACCEPTED,
      days: 7,
      template: 'follow_up_7_days',
      direction: InteractionDirection.TO_PROVIDER,
    },
    IN_PROGRESS_5_DAYS: {
      status: RequestStatus.IN_PROGRESS,
      days: 5,
      template: 'follow_up_5_days_in_progress',
      direction: InteractionDirection.TO_PROVIDER,
    },
    IN_PROGRESS_10_DAYS: {
      status: RequestStatus.IN_PROGRESS,
      days: 10,
      template: 'follow_up_10_days_in_progress',
      direction: InteractionDirection.TO_PROVIDER,
    },
    DONE_1_DAY: {
      status: RequestStatus.DONE,
      days: 1,
      template: 'follow_up_review_1_day',
      direction: InteractionDirection.TO_CLIENT,
    },
  };

  constructor(
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
    @Inject(REQUEST_INTERACTION_REPOSITORY)
    private readonly interactionRepository: RequestInteractionRepository,
    private readonly interactionService: RequestInteractionService,
    private readonly config: ConfigService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => ProfessionalService))
    private readonly professionalService: ProfessionalService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
  ) {}

  /**
   * Run every hour to schedule follow-ups.
   * Format: second minute hour day month dayOfWeek
   */
  @Cron('0 * * * *')
  async scheduleFollowUps(): Promise<void> {
    const startTime = Date.now();
    const enabled = this.config.get<string>(
      'WHATSAPP_FOLLOWUP_ENABLED',
      'false',
    );

    if (enabled !== 'true') {
      this.logger.debug('WhatsApp follow-ups are disabled');
      return;
    }

    this.logger.debug('Starting follow-up scheduler job');

    try {
      const now = new Date();
      let totalScheduled = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      // Process each follow-up rule
      for (const [ruleName, rule] of Object.entries(this.followUpRules)) {
        try {
          const result = await this.processFollowUpRule(ruleName, rule, now);
          totalScheduled += result.scheduled;
          totalSkipped += result.skipped;
        } catch (error: any) {
          totalErrors++;
          this.logger.error(
            `Error processing follow-up rule ${ruleName}: Error=${error.message}`,
            error.stack,
          );
        }
      }

      const duration = Date.now() - startTime;
      if (totalScheduled > 0 || totalSkipped > 0 || totalErrors > 0) {
        this.logger.log(
          `Follow-up scheduler job completed: Scheduled=${totalScheduled}, Skipped=${totalSkipped}, Errors=${totalErrors}, Duration=${duration}ms`,
        );
      } else {
        this.logger.debug(
          `Follow-up scheduler job completed: No follow-ups needed, Duration=${duration}ms`,
        );
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Follow-up scheduler job failed: Error=${error.message}, Duration=${duration}ms`,
        error.stack,
      );
      // Don't throw - we want the job to continue running on next schedule
    }
  }

  /**
   * Process a single follow-up rule.
   * Returns the number of follow-ups scheduled and skipped.
   */
  private async processFollowUpRule(
    ruleName: string,
    rule: {
      status: RequestStatus;
      days: number;
      template: string;
      direction: InteractionDirection;
    },
    now: Date,
  ): Promise<{ scheduled: number; skipped: number }> {
    // Calculate cutoff date (requests updated before this date need follow-up)
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - rule.days);

    // Find requests matching the rule
    const requests =
      await this.requestRepository.findByStatusAndUpdatedBefore(
        rule.status,
        cutoffDate,
      );

    if (requests.length === 0) {
      return { scheduled: 0, skipped: 0 };
    }

    this.logger.debug(
      `Processing rule ${ruleName}: Found ${requests.length} requests (Status=${rule.status}, Days=${rule.days})`,
    );

    let scheduled = 0;
    let skipped = 0;

    for (const request of requests) {
      try {
        // Check if there's already a pending follow-up for this request
        const hasPending = await this.interactionRepository.hasPendingFollowUp(
          request.id,
        );

        if (hasPending) {
          skipped++;
          this.logger.debug(
            `Skipping RequestId=${request.id}: Already has pending follow-up`,
          );
          continue;
        }

        // Get the most recent interaction to check if we should skip
        const lastInteraction =
          await this.interactionRepository.findMostRecentByRequestId(
            request.id,
          );

        // If there's a recent interaction (within the last day), skip
        if (lastInteraction) {
          const daysSinceLastInteraction =
            (now.getTime() - lastInteraction.createdAt.getTime()) /
            (1000 * 60 * 60 * 24);

          if (daysSinceLastInteraction < 1) {
            skipped++;
            this.logger.debug(
              `Skipping RequestId=${request.id}: Recent interaction ${daysSinceLastInteraction.toFixed(2)} days ago`,
            );
            continue;
          }
        }

        // Validate that request can receive follow-up (has recipient with verified phone)
        const canReceive = await this.canReceiveFollowUp(
          request,
          rule.direction,
        );
        if (!canReceive) {
          skipped++;
          this.logger.debug(
            `Skipping RequestId=${request.id}: Cannot receive follow-up (missing recipient or unverified phone)`,
          );
          continue;
        }

        // Schedule follow-up for immediate dispatch (scheduledFor = now)
        await this.interactionService.createFollowUp({
          requestId: request.id,
          direction: rule.direction,
          messageTemplate: rule.template,
          scheduledFor: now,
          metadata: {
            rule: ruleName,
            daysSinceUpdate: rule.days,
            requestStatus: request.status,
          },
        });

        scheduled++;
        this.logger.debug(
          `Scheduled follow-up: RequestId=${request.id}, Rule=${ruleName}, Template=${rule.template}`,
        );
      } catch (error: any) {
        skipped++;
        this.logger.error(
          `Failed to schedule follow-up: RequestId=${request.id}, Rule=${ruleName}, Error=${error.message}`,
          error.stack,
        );
      }
    }

    if (scheduled > 0 || skipped > 0) {
      this.logger.log(
        `Rule ${ruleName} processed: Scheduled=${scheduled}, Skipped=${skipped}`,
      );
    }

    return { scheduled, skipped };
  }

  /**
   * Check if a request can receive a follow-up.
   * Validates that the recipient (client or provider) exists and has verified phone.
   */
  private async canReceiveFollowUp(
    request: any,
    direction: InteractionDirection,
  ): Promise<boolean> {
    if (direction === InteractionDirection.TO_PROVIDER) {
      // Need provider assigned
      if (!request.providerId) {
        return false;
      }

      // Check if provider has verified phone
      try {
        const professional =
          await this.professionalService.findByServiceProviderId(
            request.providerId,
          );
        if (professional) {
          // Check professional's whatsapp or user's phone
          if (professional.whatsapp) {
            return true;
          }
          const user = await this.userService.findById(professional.userId);
          return !!(user?.phone && user.phoneVerified);
        }

        const company = await this.companyService.findByServiceProviderId(
          request.providerId,
        );
        if (company) {
          if (company.phone) {
            return true;
          }
          const user = await this.userService.findById(company.userId);
          return !!(user?.phone && user.phoneVerified);
        }
      } catch (error) {
        this.logger.warn(
          `Error checking provider phone for request ${request.id}`,
          error,
        );
        return false;
      }

      return false;
    } else {
      // Need client with verified phone
      if (!request.clientId) {
        return false;
      }

      try {
        const user = await this.userService.findById(request.clientId);
        return !!(user?.phone && user.phoneVerified);
      } catch (error) {
        this.logger.warn(
          `Error checking client phone for request ${request.id}`,
          error,
        );
        return false;
      }
    }
  }
}

