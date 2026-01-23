import { RequestStatus } from '@prisma/client';

/**
 * Context for authorization checks.
 * - serviceProviderId: the current user's provider ID (Professional or Company)
 */
export interface RequestAuthContext {
  userId: string;
  serviceProviderId?: string | null;
  isAdmin?: boolean;
}

export class RequestEntity {
  static createPending(params: {
    id: string;
    clientId: string;
    providerId: string | null;
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
      params.providerId,
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
    public readonly providerId: string | null, // ServiceProvider ID
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

  /**
   * @deprecated Use providerId instead. This getter is for backward compatibility.
   */
  get professionalId(): string | null {
    return this.providerId;
  }

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
   * Helper to check if user is the assigned provider (Professional or Company)
   */
  private isAssignedProvider(ctx: RequestAuthContext): boolean {
    return !!(
      this.providerId &&
      ctx.serviceProviderId &&
      ctx.serviceProviderId === this.providerId
    );
  }

  /**
   * Determines if a user can view this request.
   * Rules:
   * - Admins can view any request
   * - The client who created the request can view it
   * - The assigned provider can view it
   * - Any provider can view available public requests (pending, no provider assigned)
   */
  canBeViewedBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    if (this.isClient(ctx)) return true;
    if (this.isAssignedProvider(ctx)) return true;

    // Available public request (any provider can view to express interest)
    if (
      this.isPublic &&
      this.status === RequestStatus.PENDING &&
      !this.providerId &&
      ctx.serviceProviderId
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
   * - Assigned provider can manage photos
   * - Cannot manage photos on cancelled requests
   */
  canManagePhotosBy(ctx: RequestAuthContext): boolean {
    if (this.isCancelled()) return false;
    if (ctx.isAdmin) return true;
    if (this.isClient(ctx)) return true;
    if (this.isAssignedProvider(ctx)) return true;
    return false;
  }

  /**
   * Determines if a user can change the status of this request.
   * Rules:
   * - Admins can change any status
   * - Client can: CANCEL (from non-terminal states)
   * - Assigned provider can: PENDING→ACCEPTED, ACCEPTED→IN_PROGRESS, IN_PROGRESS→DONE
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

    // Assigned provider permissions
    if (this.isAssignedProvider(ctx)) {
      // Provider can accept pending direct requests
      if (this.isPending() && newStatus === RequestStatus.ACCEPTED) {
        return true;
      }
      // Provider can start work on accepted requests
      if (this.isAccepted() && newStatus === RequestStatus.IN_PROGRESS) {
        return true;
      }
      // Provider can complete in-progress requests
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
   * - Only the assigned provider can rate
   * - Only after work is done (DONE status)
   * - Only once (clientRating must be null)
   */
  canRateClientBy(ctx: RequestAuthContext): boolean {
    if (!this.isDone()) return false;
    if (this.clientRating !== null) return false; // Already rated
    return this.isAssignedProvider(ctx);
  }

  /**
   * Determines if a provider can express interest in this request.
   * Rules:
   * - Must be a public request
   * - Must be pending
   * - Must not have an assigned provider yet
   * - User must have a provider profile (Professional or Company)
   */
  canExpressInterestBy(ctx: RequestAuthContext): boolean {
    if (!ctx.serviceProviderId) return false;
    return this.isPublic && this.isPending() && !this.providerId;
  }

  /**
   * Determines if a user can assign a provider to this request.
   * Rules:
   * - Admins can assign
   * - Only the client owner can assign
   * - Request must be public and pending
   */
  canAssignProviderBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    if (!this.isClient(ctx)) return false;
    return this.isPublic && this.isPending();
  }

  /**
   * @deprecated Use canAssignProviderBy instead
   */
  canAssignProfessionalBy(ctx: RequestAuthContext): boolean {
    return this.canAssignProviderBy(ctx);
  }

  /**
   * Determines if a user can unassign the provider from this request.
   * Rules:
   * - Only the client owner can unassign
   * - Request must have a provider assigned
   * - Request status must be ACCEPTED (not yet started)
   */
  canUnassignProviderBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    if (!this.isClient(ctx)) return false;
    return !!this.providerId && this.isAccepted();
  }

  withChanges(changes: {
    providerId?: string | null;
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
      changes.providerId !== undefined ? changes.providerId : this.providerId,
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
