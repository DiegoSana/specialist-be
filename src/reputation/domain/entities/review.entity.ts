import { ReviewStatus } from '../value-objects/review-status';

/**
 * Authorization context for review operations
 */
export interface ReviewAuthContext {
  userId: string;
  isAdmin: boolean;
  isReviewer: boolean; // Is the user the one who created this review?
}

export class ReviewEntity {
  static create(params: {
    id: string;
    reviewerId: string;
    serviceProviderId: string;
    requestId: string; // Reviews are always tied to a request
    rating: number;
    comment: string | null;
    status?: ReviewStatus;
    now?: Date;
  }): ReviewEntity {
    const now = params.now ?? new Date();
    return new ReviewEntity(
      params.id,
      params.reviewerId,
      params.serviceProviderId,
      params.requestId,
      params.rating,
      params.comment,
      params.status ?? ReviewStatus.PENDING,
      null, // moderatedAt
      null, // moderatedBy
      now,
      now,
    );
  }

  constructor(
    public readonly id: string,
    public readonly reviewerId: string,
    public readonly serviceProviderId: string, // ServiceProvider being reviewed
    public readonly requestId: string, // Reviews are always tied to a request
    public readonly rating: number,
    public readonly comment: string | null,
    public readonly status: ReviewStatus,
    public readonly moderatedAt: Date | null,
    public readonly moderatedBy: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * @deprecated Use serviceProviderId instead. This getter is for backward compatibility.
   */
  get professionalId(): string {
    return this.serviceProviderId;
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

  withChanges(changes: {
    rating?: number;
    comment?: string | null;
    now?: Date;
  }): ReviewEntity {
    const now = changes.now ?? new Date();
    return new ReviewEntity(
      this.id,
      this.reviewerId,
      this.serviceProviderId,
      this.requestId,
      changes.rating !== undefined ? changes.rating : this.rating,
      changes.comment !== undefined ? changes.comment : this.comment,
      this.status,
      this.moderatedAt,
      this.moderatedBy,
      this.createdAt,
      now,
    );
  }

  approve(moderatorId: string, now?: Date): ReviewEntity {
    const moderatedAt = now ?? new Date();
    return new ReviewEntity(
      this.id,
      this.reviewerId,
      this.serviceProviderId,
      this.requestId,
      this.rating,
      this.comment,
      ReviewStatus.APPROVED,
      moderatedAt,
      moderatorId,
      this.createdAt,
      moderatedAt,
    );
  }

  reject(moderatorId: string, now?: Date): ReviewEntity {
    const moderatedAt = now ?? new Date();
    return new ReviewEntity(
      this.id,
      this.reviewerId,
      this.serviceProviderId,
      this.requestId,
      this.rating,
      this.comment,
      ReviewStatus.REJECTED,
      moderatedAt,
      moderatorId,
      this.createdAt,
      moderatedAt,
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
    };
  }

  /**
   * Who can view this review?
   * - APPROVED reviews: anyone (public)
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
}
