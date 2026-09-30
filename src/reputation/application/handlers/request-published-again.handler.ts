import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { RequestStatusChangedEvent } from '../../../requests/domain/events/request-status-changed.event';
import { ReviewService } from '../services/review.service';

/**
 * Reacts to a request being (re)published: both `RequestInterestService.unassignProvider` and
 * `RequestService.updateStatus`'s PUBLISHED-normalization block publish
 * `RequestStatusChangedEvent` with `toStatus: PUBLISHED` whenever a stale provider is cleared,
 * meaning the request is restarting its engagement from scratch (a client can unassign and later
 * reassign a different provider to the same request).
 *
 * `Review(requestId, direction)` is unique per direction — a request can have at most one review
 * per direction, ever — so leftover reviews from the previous engagement (either direction) would
 * otherwise permanently block reviewing whoever gets assigned next, or (for the client-rating
 * direction) survive into a relationship with a different provider. This handler deletes both, if
 * present, so a freshly-reassigned request starts with a clean slate for reviews too
 * (clientRating/clientRatingComment, the pre-redesign flat fields, are reset by the two `requests`
 * call sites themselves, not here — see src/requests/CLAUDE.md).
 *
 * Lives in `reputation` (not `requests`) to avoid a circular module dependency at the wrong
 * layer — mirroring `RequestAttentionFlaggedHandler`'s cross-context pattern in `notifications`.
 *
 * Delegates to `ReviewService.deleteAllForRequest`, which bypasses reviewer-only authorization
 * (the wrong shape for this system cleanup, which must remove reviews regardless of status) and
 * recomputes whichever rating (ServiceProvider or User.clientAverageRating) was affected.
 */
@Injectable()
export class RequestPublishedAgainHandler implements OnModuleInit {
  private readonly logger = new Logger(RequestPublishedAgainHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    private readonly reviewService: ReviewService,
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
      await this.reviewService.deleteAllForRequest(event.payload.requestId);
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (requestId=${event.payload.requestId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
