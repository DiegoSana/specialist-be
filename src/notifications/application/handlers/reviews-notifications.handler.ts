import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { NotificationService } from '../services/notification.service';
import { ReviewApprovedEvent } from '../../../reputation/domain/events/review-approved.event';

/**
 * Application-level event handler that creates notifications
 * when reviews are approved (after moderation).
 */
@Injectable()
export class ReviewsNotificationsHandler implements OnModuleInit {
  private readonly logger = new Logger(ReviewsNotificationsHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    if (typeof this.eventBus?.on !== 'function') {
      this.logger.warn(
        'EventBus does not support subscriptions; review notifications will not be generated.',
      );
      return;
    }

    this.eventBus.on(ReviewApprovedEvent.EVENT_NAME, (event: ReviewApprovedEvent) =>
      this.onReviewApproved(event),
    );
  }

  private async onReviewApproved(event: ReviewApprovedEvent): Promise<void> {
    const { reviewId, professionalUserId, rating, comment } = event.payload;

    try {
      const stars = '⭐'.repeat(rating);
      const body = comment
        ? `${stars} - "${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}"`
        : stars;

      await this.notifications.createForUser({
        userId: professionalUserId,
        type: 'REVIEW_APPROVED',
        title: '¡Tenés una nueva reseña!',
        body,
        data: {
          reviewId,
          professionalId: event.payload.professionalId,
          rating,
        },
        idempotencyKey: `${event.name}:${reviewId}`,
        includeExternal: true,
      });

      this.logger.log(
        `Notification created for approved review ${reviewId} to user ${professionalUserId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (reviewId=${reviewId}, professionalUserId=${professionalUserId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}

