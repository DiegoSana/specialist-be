import { RequestStatus } from '@prisma/client';

/**
 * Context for authorization checks.
 * - serviceProviderId: the current user's provider ID (Professional or Company)
 * - hasActiveClientProfile / hasActiveProviderProfile: from ProfileActivationService
 *   (single orchestration point); do not duplicate isFullyVerified/canOperate elsewhere.
 * - isSystem: the request-expiration cron job (Sistema actor per the state machine spec).
 * - isSupport: a support agent resolving an UNDER_REVIEW request (Soporte actor).
 */
export interface RequestAuthContext {
  userId: string;
  serviceProviderId?: string | null;
  isAdmin?: boolean;
  isSystem?: boolean;
  isSupport?: boolean;
  /** Client profile exists and user is fully verified (email + phone) */
  hasActiveClientProfile?: boolean;
  /** Provider profile canOperate and user is fully verified */
  hasActiveProviderProfile?: boolean;
}

export type ActorKind = 'CLIENT' | 'PROVIDER' | 'SYSTEM' | 'SUPPORT';

/**
 * Who can move a request from one status to another, mirroring
 * "docs/EspecialistBRC — Estados del pedido.md" ("Quién puede mover cada cosa") line for line.
 * SYSTEM/SUPPORT entries are wired ahead of their producers (request-expiration job, support
 * review endpoint) landing in later PRs — the table stays a complete mirror of the spec from day
 * one even though those transitions are unreachable until then.
 */
const TRANSITIONS: Partial<
  Record<RequestStatus, Partial<Record<RequestStatus, ActorKind[]>>>
> = {
  [RequestStatus.DRAFT]: {
    [RequestStatus.PUBLISHED]: ['CLIENT'],
    [RequestStatus.SENT]: ['CLIENT'],
  },
  [RequestStatus.PUBLISHED]: {
    [RequestStatus.CONTACT_RELEASED]: ['CLIENT'],
    [RequestStatus.CANCELLED]: ['CLIENT'],
    [RequestStatus.EXPIRED]: ['SYSTEM'],
  },
  [RequestStatus.SENT]: {
    [RequestStatus.CONTACT_RELEASED]: ['PROVIDER'],
    [RequestStatus.REJECTED]: ['PROVIDER'],
    [RequestStatus.CANCELLED]: ['CLIENT'],
    [RequestStatus.NO_RESPONSE]: ['SYSTEM'],
  },
  [RequestStatus.CONTACT_RELEASED]: {
    [RequestStatus.IN_PROGRESS]: ['CLIENT', 'PROVIDER'],
    [RequestStatus.NOT_COMPLETED]: ['CLIENT', 'PROVIDER'],
    [RequestStatus.ABANDONED]: ['SYSTEM'],
  },
  [RequestStatus.IN_PROGRESS]: {
    [RequestStatus.FINISHED]: ['PROVIDER'],
    // Both parties may report an interruption (FE brief item 6); the original spec only listed the
    // provider — see the "Quién puede mover cada cosa" table in docs/EspecialistBRC — Estados del pedido.md.
    [RequestStatus.INTERRUPTED]: ['CLIENT', 'PROVIDER'],
    // IN_PROGRESS -> ABANDONED is explicitly "por definir" in the spec (open question); not
    // mapped yet, see docs/EspecialistBRC — Estados del pedido.md, section "Decisiones/Abiertas".
  },
  [RequestStatus.FINISHED]: {
    [RequestStatus.CLOSED]: ['CLIENT', 'SYSTEM'],
    [RequestStatus.UNDER_REVIEW]: ['CLIENT'],
  },
  [RequestStatus.UNDER_REVIEW]: {
    [RequestStatus.CLOSED]: ['SUPPORT'],
  },
};

export class RequestEntity {
  static createDraft(params: {
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
      RequestStatus.DRAFT,
      null,
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
    public readonly statusReason: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * @deprecated Use providerId instead. This getter is for backward compatibility.
   */
  get professionalId(): string | null {
    return this.providerId;
  }

  isDraft(): boolean {
    return this.status === RequestStatus.DRAFT;
  }

  isPublished(): boolean {
    return this.status === RequestStatus.PUBLISHED;
  }

  isSent(): boolean {
    return this.status === RequestStatus.SENT;
  }

  isContactReleased(): boolean {
    return this.status === RequestStatus.CONTACT_RELEASED;
  }

  isInProgress(): boolean {
    return this.status === RequestStatus.IN_PROGRESS;
  }

  isFinished(): boolean {
    return this.status === RequestStatus.FINISHED;
  }

  isClosed(): boolean {
    return this.status === RequestStatus.CLOSED;
  }

  isUnderReview(): boolean {
    return this.status === RequestStatus.UNDER_REVIEW;
  }

  isExpired(): boolean {
    return this.status === RequestStatus.EXPIRED;
  }

  isNoResponse(): boolean {
    return this.status === RequestStatus.NO_RESPONSE;
  }

  isRejected(): boolean {
    return this.status === RequestStatus.REJECTED;
  }

  isCancelled(): boolean {
    return this.status === RequestStatus.CANCELLED;
  }

  isNotCompleted(): boolean {
    return this.status === RequestStatus.NOT_COMPLETED;
  }

  isInterrupted(): boolean {
    return this.status === RequestStatus.INTERRUPTED;
  }

  isAbandoned(): boolean {
    return this.status === RequestStatus.ABANDONED;
  }

  /** Any status that ends the request's lifecycle (whether or not it reached CLOSED). */
  isTerminal(): boolean {
    return (
      this.isClosed() ||
      this.isExpired() ||
      this.isNoResponse() ||
      this.isRejected() ||
      this.isCancelled() ||
      this.isNotCompleted() ||
      this.isInterrupted() ||
      this.isAbandoned()
    );
  }

  /** Contact data is shared once the client chose / the provider accepted, and stays visible afterwards. */
  hasContactBeenReleased(): boolean {
    return (
      this.isContactReleased() ||
      this.isInProgress() ||
      this.isFinished() ||
      this.isUnderReview() ||
      this.isClosed()
    );
  }

  canBeReviewed(): boolean {
    return this.isClosed();
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
   * Resolves which actor kind a context represents for THIS request. System/Support are
   * explicit context flags (there is no "system user"); client/provider are derived from
   * ownership/assignment, same as the rest of the entity's authorization checks.
   */
  resolveActorKind(ctx: RequestAuthContext): ActorKind | null {
    if (ctx.isSystem) return 'SYSTEM';
    if (ctx.isSupport) return 'SUPPORT';
    if (this.isClient(ctx)) return 'CLIENT';
    if (this.isAssignedProvider(ctx)) return 'PROVIDER';
    return null;
  }

  /**
   * Determines if a user can view this request.
   * Rules:
   * - Admins can view any request
   * - The client who created the request can view it
   * - The assigned provider can view it
   * - Any provider can view available public requests (published, no provider assigned)
   */
  canBeViewedBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    if (this.isClient(ctx)) return true;
    if (this.isAssignedProvider(ctx)) return true;

    // Available public request (any provider can view to express interest)
    if (
      this.isPublic &&
      this.status === RequestStatus.PUBLISHED &&
      !this.providerId &&
      ctx.serviceProviderId
    ) {
      return true;
    }

    return false;
  }

  /**
   * Determines if a user can see the other party's contact data (phone/email).
   * Rules:
   * - Admins can always see it
   * - Only the client owner and the assigned provider, and only once contact was released
   *   (never in DRAFT/PUBLISHED/SENT, nor in terminal no-agreement states)
   */
  canViewCounterpartContactBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    if (!this.hasContactBeenReleased()) return false;
    return this.isClient(ctx) || this.isAssignedProvider(ctx);
  }

  /**
   * Determines if a user can manage photos (add/remove) on this request.
   * Rules:
   * - Admins can manage photos on any request
   * - Client can manage photos on their requests
   * - Assigned provider can manage photos
   * - Not allowed on terminal states, except CLOSED (finished work keeps receiving photos)
   */
  canManagePhotosBy(ctx: RequestAuthContext): boolean {
    if (this.isTerminal() && !this.isClosed()) return false;
    if (ctx.isAdmin) return true;
    if (this.isClient(ctx)) return true;
    if (this.isAssignedProvider(ctx)) return true;
    return false;
  }

  /**
   * Determines if a user (or the system/support actor) can change the status of this request.
   * Mirrors the TRANSITIONS table above, which is itself a 1:1 mirror of the spec's "Quién puede
   * mover cada cosa" table.
   */
  canChangeStatusBy(
    ctx: RequestAuthContext,
    newStatus: RequestStatus,
  ): boolean {
    if (ctx.isAdmin) return true;

    const actor = this.resolveActorKind(ctx);
    if (!actor) return false;

    const allowedActors = TRANSITIONS[this.status]?.[newStatus];
    return !!allowedActors?.includes(actor);
  }

  /**
   * Determines if a user can rate the client on this request.
   * Rules:
   * - Only the assigned provider can rate
   * - Only after the request is closed (reputation only builds on CLOSED)
   * - Only once (clientRating must be null)
   */
  canRateClientBy(ctx: RequestAuthContext): boolean {
    if (!this.isClosed()) return false;
    if (this.clientRating !== null) return false; // Already rated
    return this.isAssignedProvider(ctx);
  }

  /**
   * Determines if a provider can express interest in this request.
   * Rules:
   * - Must have an active provider profile (hasActiveProviderProfile: profile can operate + user fully verified)
   * - Must be a public request, published, with no provider assigned yet
   */
  canExpressInterestBy(ctx: RequestAuthContext): boolean {
    if (!ctx.serviceProviderId) return false;
    if (!ctx.hasActiveProviderProfile) return false;
    return this.isPublic && this.isPublished() && !this.providerId;
  }

  /**
   * Determines if a user can assign a provider to this request.
   * Rules:
   * - Admins can assign
   * - Only the client owner can assign (must have active client profile: verified email + phone)
   * - Request must be public and published
   */
  canAssignProviderBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    if (!this.isClient(ctx)) return false;
    if (ctx.hasActiveClientProfile === false) return false;
    return this.isPublic && this.isPublished();
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
   * - Request status must be CONTACT_RELEASED (not yet started)
   *
   * This is a corrective/internal action, not the product's normal recovery path for a
   * request that didn't work out with the chosen provider (that path is "client creates a new
   * request", per the spec's "Decisiones/Tomadas" — see docs/EspecialistBRC — Estados del
   * pedido.md). Revisit whether this should stay client-facing once re-publishing ships.
   */
  canUnassignProviderBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    if (!this.isClient(ctx)) return false;
    return !!this.providerId && this.isContactReleased();
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
    statusReason?: string | null;
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
      changes.statusReason !== undefined
        ? changes.statusReason
        : this.statusReason,
      this.createdAt,
      now,
    );
  }
}
