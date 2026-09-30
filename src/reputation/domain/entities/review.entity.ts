import { ReviewStatus } from '../value-objects/review-status';
import { ReviewDirection } from '@prisma/client';

/**
 * Authorization context for review operations
 */
export interface ReviewAuthContext {
  userId: string;
  isAdmin: boolean;
  isReviewer: boolean; // Is the user the one who created this review?
  /** Is the user the one being reviewed (the other party in the request)? */
  isReviewee?: boolean;
}

export class ReviewEntity {
  static create(params: {
    id: string;
    direction: ReviewDirection;
    reviewerId: string;
    revieweeUserId: string;
    serviceProviderId: string | null;
    requestId: string; // Reviews are always tied to a request
    rating: number;
    comment: string | null;
    status?: ReviewStatus;
    now?: Date;
  }): ReviewEntity {
    const now = params.now ?? new Date();
    return new ReviewEntity(
      params.id,
      params.direction,
      params.reviewerId,
      params.revieweeUserId,
      params.serviceProviderId,
      params.requestId,
      params.rating,
      params.comment,
      params.status ?? ReviewStatus.PENDING,
      null, // moderatedAt
      null, // moderatedBy
      null, // revealedAt
      false, // isFeatured
      now,
      now,
    );
  }

  constructor(
    public readonly id: string,
    public readonly direction: ReviewDirection,
    public readonly reviewerId: string,
    public readonly revieweeUserId: string,
    // ServiceProvider being reviewed. Only set for CLIENT_TO_PROVIDER reviews.
    public readonly serviceProviderId: string | null,
    public readonly requestId: string, // Reviews are always tied to a request
    public readonly rating: number,
    public readonly comment: string | null,
    public readonly status: ReviewStatus,
    public readonly moderatedAt: Date | null,
    public readonly moderatedBy: string | null,
    public readonly revealedAt: Date | null,
    public readonly isFeatured: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * @deprecated Use serviceProviderId instead. This getter is for backward compatibility.
   */
  get professionalId(): string | null {
    return this.serviceProviderId;
  }

  isClientToProvider(): boolean {
    return this.direction === ReviewDirection.CLIENT_TO_PROVIDER;
  }

  isProviderToClient(): boolean {
    return this.direction === ReviewDirection.PROVIDER_TO_CLIENT;
  }

  isValidRating(): boolean {
    return this.rating >= 1 && this.rating <= 5;
  }

  isPending(): boolean {
    return this.status === ReviewStatus.PENDING;
  }

  isApproved(): boolean {
    return this.status === ReviewStatus.APPROVED;
  }

  isRejected(): boolean {
    return this.status === ReviewStatus.REJECTED;
  }

  isRevealed(): boolean {
    return this.revealedAt !== null;
  }

  withChanges(changes: {
    rating?: number;
    comment?: string | null;
    now?: Date;
  }): ReviewEntity {
    const now = changes.now ?? new Date();
    return new ReviewEntity(
      this.id,
      this.direction,
      this.reviewerId,
      this.revieweeUserId,
      this.serviceProviderId,
      this.requestId,
      changes.rating !== undefined ? changes.rating : this.rating,
      changes.comment !== undefined ? changes.comment : this.comment,
      this.status,
      this.moderatedAt,
      this.moderatedBy,
      this.revealedAt,
      this.isFeatured,
      this.createdAt,
      now,
    );
  }

  approve(moderatorId: string, now?: Date): ReviewEntity {
    const moderatedAt = now ?? new Date();
    return new ReviewEntity(
      this.id,
      this.direction,
      this.reviewerId,
      this.revieweeUserId,
      this.serviceProviderId,
      this.requestId,
      this.rating,
      this.comment,
      ReviewStatus.APPROVED,
      moderatedAt,
      moderatorId,
      this.revealedAt,
      this.isFeatured,
      this.createdAt,
      moderatedAt,
    );
  }

  reject(moderatorId: string, now?: Date): ReviewEntity {
    const moderatedAt = now ?? new Date();
    return new ReviewEntity(
      this.id,
      this.direction,
      this.reviewerId,
      this.revieweeUserId,
      this.serviceProviderId,
      this.requestId,
      this.rating,
      this.comment,
      ReviewStatus.REJECTED,
      moderatedAt,
      moderatorId,
      this.revealedAt,
      this.isFeatured,
      this.createdAt,
      moderatedAt,
    );
  }

  /** Doble-ciego reveal: sets revealedAt once both parties rated (or the timeout elapsed). */
  reveal(now?: Date): ReviewEntity {
    const revealedAt = now ?? new Date();
    return new ReviewEntity(
      this.id,
      this.direction,
      this.reviewerId,
      this.revieweeUserId,
      this.serviceProviderId,
      this.requestId,
      this.rating,
      this.comment,
      this.status,
      this.moderatedAt,
      this.moderatedBy,
      revealedAt,
      this.isFeatured,
      this.createdAt,
      now ?? new Date(),
    );
  }

  withFeatured(isFeatured: boolean, now?: Date): ReviewEntity {
    return new ReviewEntity(
      this.id,
      this.direction,
      this.reviewerId,
      this.revieweeUserId,
      this.serviceProviderId,
      this.requestId,
      this.rating,
      this.comment,
      this.status,
      this.moderatedAt,
      this.moderatedBy,
      this.revealedAt,
      isFeatured,
      this.createdAt,
      now ?? new Date(),
    );
  }

  // ========== Authorization Methods ==========

  /**
   * Build auth context from user data
   */
  buildAuthContext(userId: string, isAdmin: boolean): ReviewAuthContext {
    return {
      userId,
      isAdmin,
      isReviewer: this.reviewerId === userId,
      isReviewee: this.revieweeUserId === userId,
    };
  }

  /**
   * Who can view this review?
   * - APPROVED reviews: anyone (public) — but see canRevealContentBy for the doble-ciego gate on
   *   the counterpart's content specifically; this rule is about the review row in general
   *   (moderation, own-authored review, admin).
   * - PENDING reviews: reviewer + admins
   * - REJECTED reviews: reviewer + admins
   */
  canBeViewedBy(ctx: ReviewAuthContext): boolean {
    // Approved reviews are public
    if (this.isApproved()) {
      return true;
    }

    // Pending or rejected: only reviewer or admin
    return ctx.isReviewer || ctx.isAdmin;
  }

  /**
   * Whether the full content (rating/comment) of this review can be shown to ctx right now.
   * - Admins and the review's own author always see it.
   * - The reviewee (counterpart) only sees it once revealed (doble-ciego con timeout) — even
   *   though they know their own review was submitted, they can't see what was written about them
   *   until both parties rated or the reveal timeout elapsed.
   * - Anyone else: only if approved and revealed (public display, e.g. featured comments).
   */
  canRevealContentBy(ctx: ReviewAuthContext): boolean {
    if (ctx.isAdmin || ctx.isReviewer) return true;
    return this.isApproved() && this.isRevealed();
  }

  /**
   * Convenience wrapper around canRevealContentBy for callers outside this context (e.g. the
   * requests presentation layer building myReview/counterpartReview) that only have a userId and
   * an isAdmin flag, not a full ReviewAuthContext.
   */
  isVisibleTo(viewerUserId: string, isAdmin: boolean): boolean {
    return this.canRevealContentBy(
      this.buildAuthContext(viewerUserId, isAdmin),
    );
  }

  /**
   * Who can modify (update/delete) this review?
   * - Only the reviewer who created it
   * - Only if still PENDING (once approved/rejected, cannot modify)
   */
  canBeModifiedBy(ctx: ReviewAuthContext): boolean {
    // Must be the reviewer
    if (!ctx.isReviewer) {
      return false;
    }

    // Can only modify pending reviews
    return this.isPending();
  }

  /**
   * Who can moderate (approve/reject) this review?
   * - Only admins
   * - Only if PENDING
   */
  canBeModeratedBy(ctx: ReviewAuthContext): boolean {
    if (!ctx.isAdmin) {
      return false;
    }

    return this.isPending();
  }

  /**
   * Who can toggle the isFeatured flag (admin-curated highlight)?
   * - Only admins, and only on an APPROVED review (nothing else is ever shown publicly).
   */
  canBeFeaturedBy(ctx: ReviewAuthContext): boolean {
    return ctx.isAdmin && this.isApproved();
  }
}
