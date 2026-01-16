import { ProfessionalStatus } from '@prisma/client';
import { ServiceProviderEntity } from './service-provider.entity';

export interface TradeInfo {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isPrimary: boolean;
}

/**
 * Authorization context for professional profile operations.
 */
export interface ProfessionalAuthContext {
  userId: string;
  isAdmin: boolean;
}

export class ProfessionalEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly serviceProviderId: string,
    public readonly trades: TradeInfo[],
    public readonly description: string | null,
    public readonly experienceYears: number | null,
    public readonly status: ProfessionalStatus,
    public readonly zone: string | null,
    public readonly city: string,
    public readonly address: string | null,
    public readonly whatsapp: string | null,
    public readonly website: string | null,
    public readonly profileImage: string | null,
    public readonly gallery: string[],
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    // Optional: the full ServiceProvider entity when needed
    public readonly serviceProvider?: ServiceProviderEntity,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Rating Properties (delegated to ServiceProvider)
  // ─────────────────────────────────────────────────────────────

  get averageRating(): number {
    return this.serviceProvider?.averageRating ?? 0;
  }

  get totalReviews(): number {
    return this.serviceProvider?.totalReviews ?? 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Computed Properties
  // ─────────────────────────────────────────────────────────────

  get primaryTrade(): TradeInfo | null {
    return this.trades.find((t) => t.isPrimary) || this.trades[0] || null;
  }

  get tradeIds(): string[] {
    return this.trades.map((t) => t.id);
  }

  // ─────────────────────────────────────────────────────────────
  // Status Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if professional has the VERIFIED status (special badge)
   */
  hasVerifiedBadge(): boolean {
    return this.status === ProfessionalStatus.VERIFIED;
  }

  isPending(): boolean {
    return this.status === ProfessionalStatus.PENDING_VERIFICATION;
  }

  isRejected(): boolean {
    return this.status === ProfessionalStatus.REJECTED;
  }

  isSuspended(): boolean {
    return this.status === ProfessionalStatus.SUSPENDED;
  }

  isInactive(): boolean {
    return this.status === ProfessionalStatus.INACTIVE;
  }

  /**
   * Check if the professional can operate (express interest, receive requests, etc.)
   * Only ACTIVE or VERIFIED status allows operation.
   */
  canOperate(): boolean {
    return this.active && 
           (this.status === ProfessionalStatus.ACTIVE || 
            this.status === ProfessionalStatus.VERIFIED);
  }

  /**
   * Check if the professional can be activated.
   * Can activate from PENDING, INACTIVE, or re-activate from ACTIVE/VERIFIED.
   */
  canBeActivated(): boolean {
    return this.status === ProfessionalStatus.PENDING_VERIFICATION ||
           this.status === ProfessionalStatus.INACTIVE ||
           this.status === ProfessionalStatus.ACTIVE ||
           this.status === ProfessionalStatus.VERIFIED;
  }

  /**
   * Check if the professional can be deactivated.
   * Only ACTIVE or VERIFIED can be deactivated.
   */
  canBeDeactivated(): boolean {
    return this.status === ProfessionalStatus.ACTIVE ||
           this.status === ProfessionalStatus.VERIFIED;
  }

  /**
   * @deprecated Use hasVerifiedBadge() instead
   */
  isVerified(): boolean {
    return this.hasVerifiedBadge();
  }

  /**
   * @deprecated Use canOperate() instead
   */
  isActive(): boolean {
    return this.canOperate();
  }

  // ─────────────────────────────────────────────────────────────
  // Authorization Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if the professional profile is owned by the given user.
   */
  isOwnedBy(userId: string): boolean {
    return this.userId === userId;
  }

  /**
   * Check if user can view the full profile (including contact info).
   * - Owner can always see full profile
   * - Admin can see full profile
   * - Public users see sanitized profile (handled by service)
   */
  canViewFullProfileBy(ctx: ProfessionalAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.isOwnedBy(ctx.userId);
  }

  /**
   * Check if user can edit this professional profile.
   * - Only owner or admin can edit
   */
  canBeEditedBy(ctx: ProfessionalAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.isOwnedBy(ctx.userId);
  }

  /**
   * Check if user can manage gallery (add/remove items).
   * - Only owner or admin can manage gallery
   */
  canManageGalleryBy(ctx: ProfessionalAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.isOwnedBy(ctx.userId);
  }

  /**
   * Check if user can change the professional status.
   * - Only admins can change status
   */
  canChangeStatusBy(ctx: ProfessionalAuthContext): boolean {
    return ctx.isAdmin;
  }

  // ─────────────────────────────────────────────────────────────
  // Helper: Build AuthContext
  // ─────────────────────────────────────────────────────────────

  static buildAuthContext(userId: string, isAdmin: boolean): ProfessionalAuthContext {
    return { userId, isAdmin };
  }

  /**
   * Create a new professional entity with an associated service provider
   */
  withServiceProvider(serviceProvider: ServiceProviderEntity): ProfessionalEntity {
    return new ProfessionalEntity(
      this.id,
      this.userId,
      this.serviceProviderId,
      this.trades,
      this.description,
      this.experienceYears,
      this.status,
      this.zone,
      this.city,
      this.address,
      this.whatsapp,
      this.website,
      this.profileImage,
      this.gallery,
      this.active,
      this.createdAt,
      this.updatedAt,
      serviceProvider,
    );
  }
}
