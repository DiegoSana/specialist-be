import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  REVIEW_REPOSITORY,
  ReviewRepository,
} from '../../domain/repositories/review.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Doble-ciego con timeout (REVIEWS_REDESIGN.md 4.2.b): reveals both reviews of a request once the
 * reveal timeout has elapsed since the first review on that request was submitted, even if the
 * other party never rated. The immediate-reveal path (both APPROVED) is handled synchronously by
 * ReviewService.approve; this job only covers the timeout fallback. Same pattern as
 * RequestExpirationJob (requests context): cron + feature flag, off by default, configurable days.
 *
 * Lives in the reputation context (not requests) because it only needs REVIEW_REPOSITORY, which
 * per the cross-context rules only this context may inject.
 */
@Injectable()
export class RevealReviewsJob {
  private readonly logger = new Logger(RevealReviewsJob.name);

  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    private readonly config: ConfigService,
  ) {}

  @Cron('15 * * * *')
  async revealDue(): Promise<void> {
    if (this.config.get<string>('REVIEW_REVEAL_ENABLED', 'false') !== 'true') {
      this.logger.debug('Review reveal is disabled');
      return;
    }

    const timeoutDays = this.resolveTimeoutDays();
    const now = Date.now();

    let requestIds: string[];
    try {
      requestIds = await this.reviewRepository.findRequestIdsPendingReveal();
    } catch (error: any) {
      this.logger.error(
        `Failed to load reveal candidates: ${error.message}`,
        error.stack,
      );
      return;
    }

    if (requestIds.length === 0) {
      return;
    }

    let revealed = 0;
    let skipped = 0;
    let errors = 0;

    for (const requestId of requestIds) {
      try {
        const reviews =
          await this.reviewRepository.findAllByRequestId(requestId);
        const approved = reviews.filter((r) => r.isApproved());
        if (approved.length === 0) {
          skipped++;
          continue;
        }

        const bothApproved = reviews.length === 2 && approved.length === 2;
        const firstSubmittedAt = reviews.reduce(
          (earliest, r) => (r.createdAt < earliest ? r.createdAt : earliest),
          reviews[0].createdAt,
        );
        const timeoutElapsed =
          now - firstSubmittedAt.getTime() >= timeoutDays * DAY_MS;

        if (!bothApproved && !timeoutElapsed) {
          skipped++;
          continue;
        }

        for (const review of approved) {
          if (!review.isRevealed()) {
            await this.reviewRepository.save(review.reveal(new Date(now)));
          }
        }
        revealed++;
      } catch (error: any) {
        errors++;
        this.logger.error(
          `Failed to reveal reviews for request ${requestId}: ${error.message}`,
          error.stack,
        );
      }
    }

    if (revealed > 0 || skipped > 0 || errors > 0) {
      this.logger.log(
        `Reveal reviews job completed: Revealed=${revealed}, Skipped=${skipped}, Errors=${errors}`,
      );
    }
  }

  private resolveTimeoutDays(): number {
    const raw = Number(this.config.get<string>('REVIEW_REVEAL_TIMEOUT_DAYS'));
    return Number.isFinite(raw) && raw > 0 ? raw : 14;
  }
}
