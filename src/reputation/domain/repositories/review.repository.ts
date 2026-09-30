import { ReviewDirection } from '@prisma/client';
import { ReviewEntity } from '../entities/review.entity';
import { ReviewStatus } from '../value-objects/review-status';

export interface ReviewRepository {
  findById(id: string): Promise<ReviewEntity | null>;
  findByServiceProviderId(serviceProviderId: string): Promise<ReviewEntity[]>;
  findApprovedByServiceProviderId(
    serviceProviderId: string,
  ): Promise<ReviewEntity[]>;
  /** Approved PROVIDER_TO_CLIENT reviews for a client (User.clientAverageRating recompute). */
  findApprovedByRevieweeUserId(
    revieweeUserId: string,
    direction: ReviewDirection,
  ): Promise<ReviewEntity[]>;
  /** Approved + revealed + featured reviews for a reviewee, newest first (curated highlights). */
  findFeaturedByRevieweeUserId(
    revieweeUserId: string,
    direction: ReviewDirection,
    limit: number,
  ): Promise<ReviewEntity[]>;
  /** At most one review per (requestId, direction) — the new unique constraint. */
  findByRequestIdAndDirection(
    requestId: string,
    direction: ReviewDirection,
  ): Promise<ReviewEntity | null>;
  /** Both directions' reviews for a request (0-2 rows). */
  findAllByRequestId(requestId: string): Promise<ReviewEntity[]>;
  findByStatus(status: ReviewStatus): Promise<ReviewEntity[]>;
  /**
   * Request ids that have at least one APPROVED review with revealedAt still null — candidates
   * for RevealReviewsJob. Bounded read-model style query (like RequestExpirationJob's
   * findStaleByStatus), not a full aggregate load.
   */
  findRequestIdsPendingReveal(): Promise<string[]>;

  /**
   * Opción A (colección de agregados): persiste el aggregate completo.
   * La implementación se encarga de create vs update.
   */
  save(review: ReviewEntity): Promise<ReviewEntity>;

  delete(id: string): Promise<void>;
}

// Token for dependency injection
export const REVIEW_REPOSITORY = Symbol('ReviewRepository');
