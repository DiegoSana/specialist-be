import { RequestStatus } from '@prisma/client';

/**
 * Context for authorization checks
 */
export interface RequestAuthContext {
  userId: string;
  professionalId?: string | null;
  isAdmin?: boolean;
}

export class RequestEntity {
  static createPending(params: {
    id: string;
    clientId: string;
    professionalId: string | null;
    tradeId: string | null;
    isPublic: boolean;
    title: string;
    description: string;
    address: string | null;
    availability: string | null;
    photos?: string[];
    now?: Date;
  }): RequestEntity {
    const now = params.now ?? new Date();
    return new RequestEntity(
      params.id,
      params.clientId,
      params.professionalId,
      params.tradeId,
      params.isPublic,
      params.title,
      params.description,
      params.address,
      params.availability,
      params.photos ?? [],
      RequestStatus.PENDING,
      null,
      null,
      null,
      null,
      now,
      now,
    );
  }

  constructor(
    public readonly id: string,
    public readonly clientId: string,
    public readonly professionalId: string | null,
    public readonly tradeId: string | null,
    public readonly isPublic: boolean,
    public readonly title: string,
    public readonly description: string,
    public readonly address: string | null,
    public readonly availability: string | null,
    public readonly photos: string[],
    public readonly status: RequestStatus,
    public readonly quoteAmount: number | null,
    public readonly quoteNotes: string | null,
    public readonly clientRating: number | null,
    public readonly clientRatingComment: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isPending(): boolean {
    return this.status === RequestStatus.PENDING;
  }

  isAccepted(): boolean {
    return this.status === RequestStatus.ACCEPTED;
  }

  isInProgress(): boolean {
    return this.status === RequestStatus.IN_PROGRESS;
  }

  isDone(): boolean {
    return this.status === RequestStatus.DONE;
  }

  isCancelled(): boolean {
    return this.status === RequestStatus.CANCELLED;
  }

  canBeReviewed(): boolean {
    return this.isDone();
  }

  isPublicRequest(): boolean {
    return this.isPublic;
  }

  // ==================== AUTHORIZATION METHODS ====================

  /**
   * Helper to check if user is the client owner
   */
  private isClient(ctx: RequestAuthContext): boolean {
    return this.clientId === ctx.userId;
  }

  /**
   * Helper to check if user is the assigned professional
   */
  private isAssignedProfessional(ctx: RequestAuthContext): boolean {
    return !!(
      this.professionalId &&
      ctx.professionalId &&
      ctx.professionalId === this.professionalId
    );
  }

  /**
   * Determines if a user can view this request.
   * Rules:
   * - Admins can view any request
   * - The client who created the request can view it
   * - The assigned professional can view it
   * - Any professional can view available public requests (pending, no professional assigned)
   */
  canBeViewedBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    if (this.isClient(ctx)) return true;
    if (this.isAssignedProfessional(ctx)) return true;

    // Available public request (any professional can view to express interest)
    if (
      this.isPublic &&
      this.status === RequestStatus.PENDING &&
      !this.professionalId &&
      ctx.professionalId
    ) {
      return true;
    }

    return false;
  }

  /**
   * Determines if a user can manage photos (add/remove) on this request.
   * Rules:
   * - Admins can manage photos on any request
   * - Client can manage photos on their requests
   * - Assigned professional can manage photos
   * - Cannot manage photos on cancelled requests
   */
  canManagePhotosBy(ctx: RequestAuthContext): boolean {
    if (this.isCancelled()) return false;
    if (ctx.isAdmin) return true;
    if (this.isClient(ctx)) return true;
    if (this.isAssignedProfessional(ctx)) return true;
    return false;
  }

  /**
   * Determines if a user can change the status of this request.
   * Rules:
   * - Admins can change any status
   * - Client can: CANCEL (from non-terminal states)
   * - Assigned professional can: PENDING→ACCEPTED, ACCEPTED→IN_PROGRESS, IN_PROGRESS→DONE
   */
  canChangeStatusBy(ctx: RequestAuthContext, newStatus: RequestStatus): boolean {
    if (ctx.isAdmin) return true;

    // Client permissions
    if (this.isClient(ctx)) {
      // Client can cancel from non-terminal states
      if (newStatus === RequestStatus.CANCELLED) {
        return !this.isDone() && !this.isCancelled();
      }
      return false;
    }

    // Assigned professional permissions
    if (this.isAssignedProfessional(ctx)) {
      // Professional can accept pending direct requests
      if (this.isPending() && newStatus === RequestStatus.ACCEPTED) {
        return true;
      }
      // Professional can start work on accepted requests
      if (this.isAccepted() && newStatus === RequestStatus.IN_PROGRESS) {
        return true;
      }
      // Professional can complete in-progress requests
      if (this.isInProgress() && newStatus === RequestStatus.DONE) {
        return true;
      }
      return false;
    }

    return false;
  }

  /**
   * Determines if a user can rate the client on this request.
   * Rules:
   * - Only the assigned professional can rate
   * - Only after work is done (DONE status)
   * - Only once (clientRating must be null)
   */
  canRateClientBy(ctx: RequestAuthContext): boolean {
    if (!this.isDone()) return false;
    if (this.clientRating !== null) return false; // Already rated
    return this.isAssignedProfessional(ctx);
  }

  /**
   * Determines if a professional can express interest in this request.
   * Rules:
   * - Must be a public request
   * - Must be pending
   * - Must not have an assigned professional yet
   * - User must have a professional profile
   */
  canExpressInterestBy(ctx: RequestAuthContext): boolean {
    if (!ctx.professionalId) return false;
    return this.isPublic && this.isPending() && !this.professionalId;
  }

  /**
   * Determines if a user can assign a professional to this request.
   * Rules:
   * - Admins can assign
   * - Only the client owner can assign
   * - Request must be public and pending
   */
  canAssignProfessionalBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    if (!this.isClient(ctx)) return false;
    return this.isPublic && this.isPending();
  }

  withChanges(changes: {
    professionalId?: string | null;
    tradeId?: string | null;
    isPublic?: boolean;
    title?: string;
    description?: string;
    address?: string | null;
    availability?: string | null;
    photos?: string[];
    status?: RequestStatus;
    quoteAmount?: number | null;
    quoteNotes?: string | null;
    clientRating?: number | null;
    clientRatingComment?: string | null;
    now?: Date;
  }): RequestEntity {
    const now = changes.now ?? new Date();
    return new RequestEntity(
      this.id,
      this.clientId,
      changes.professionalId !== undefined
        ? changes.professionalId
        : this.professionalId,
      changes.tradeId !== undefined ? changes.tradeId : this.tradeId,
      changes.isPublic !== undefined ? changes.isPublic : this.isPublic,
      changes.title !== undefined ? changes.title : this.title,
      changes.description !== undefined
        ? changes.description
        : this.description,
      changes.address !== undefined ? changes.address : this.address,
      changes.availability !== undefined
        ? changes.availability
        : this.availability,
      changes.photos !== undefined ? changes.photos : this.photos,
      changes.status !== undefined ? changes.status : this.status,
      changes.quoteAmount !== undefined
        ? changes.quoteAmount
        : this.quoteAmount,
      changes.quoteNotes !== undefined ? changes.quoteNotes : this.quoteNotes,
      changes.clientRating !== undefined
        ? changes.clientRating
        : this.clientRating,
      changes.clientRatingComment !== undefined
        ? changes.clientRatingComment
        : this.clientRatingComment,
      this.createdAt,
      now,
    );
  }
}
