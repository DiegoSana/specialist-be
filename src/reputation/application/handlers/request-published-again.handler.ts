import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import {
  ReviewRepository,
  REVIEW_REPOSITORY,
} from '../../domain/repositories/review.repository';
import { RequestStatusChangedEvent } from '../../../requests/domain/events/request-status-changed.event';

/**
 * Reacts to a request being (re)published: both `RequestInterestService.unassignProvider` and
 * `RequestService.updateStatus`'s PUBLISHED-normalization block publish
 * `RequestStatusChangedEvent` with `toStatus: PUBLISHED` whenever a stale provider is cleared,
 * meaning the request is restarting its engagement from scratch (a client can unassign and later
 * reassign a different provider to the same request).
 *
 * `Review.requestId` is unique — a request can have at most one review ever — so a leftover
 * review from the previous provider would otherwise permanently block the client from reviewing
 * whoever gets assigned next. This handler deletes that stale review, if one exists, so a
 * freshly-reassigned request starts with a clean slate for reviews too (clientRating/
 * clientRatingComment are reset by the two call sites themselves, not here).
 *
 * Lives in `reputation` (not `requests`) to avoid a circular module dependency —
 * `ReputationModule` already imports `RequestsModule`, not the other way around — mirroring
 * `RequestAttentionFlaggedHandler`'s cross-context pattern in `notifications`.
 */
@Injectable()
export class RequestPublishedAgainHandler implements OnModuleInit {
  private readonly logger = new Logger(RequestPublishedAgainHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
  ) {}

  onModuleInit(): void {
    if (typeof this.eventBus?.on !== 'function') {
      this.logger.warn(
        'EventBus does not support subscriptions; stale reviews will not be cleaned up when a request is republished.',
      );
      return;
    }

    this.eventBus.on(
      RequestStatusChangedEvent.EVENT_NAME,
      (event: RequestStatusChangedEvent) => this.onStatusChanged(event),
    );
  }

  private async onStatusChanged(
    event: RequestStatusChangedEvent,
  ): Promise<void> {
    if (event.payload.toStatus !== RequestStatus.PUBLISHED) {
      return;
    }

    try {
      const { requestId } = event.payload;
      const existingReview =
        await this.reviewRepository.findByRequestId(requestId);
      if (!existingReview) {
        return;
      }
      await this.reviewRepository.delete(existingReview.id);
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (requestId=${event.payload.requestId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
