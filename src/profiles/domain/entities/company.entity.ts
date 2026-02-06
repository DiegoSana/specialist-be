import { ServiceProviderEntity } from './service-provider.entity';

/**
 * Trade info for company (same as professional)
 */
export interface TradeInfo {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isPrimary: boolean;
}

/**
 * Company status (matches Prisma enum)
 */
export enum CompanyStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION', // Awaiting admin verification
  ACTIVE = 'ACTIVE',                             // Verified, can operate
  VERIFIED = 'VERIFIED',                         // Verified + special badge
  INACTIVE = 'INACTIVE',                         // Deactivated (user has Professional active)
  REJECTED = 'REJECTED',                         // Verification failed
  SUSPENDED = 'SUSPENDED',                       // Admin suspended
}

/**
 * Authorization context for company profile operations.
 */
export interface CompanyAuthContext {
  userId: string;
  isAdmin: boolean;
}

/**
 * CompanyEntity represents a business/company profile (constructora, etc.)
 * It has similar functionality to ProfessionalEntity but with company-specific fields.
 */
export class CompanyEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly serviceProviderId: string,
    public readonly companyName: string,
    public readonly legalName: string | null,
    public readonly taxId: string | null,
    public readonly trades: TradeInfo[],
    public readonly description: string | null,
    public readonly foundedYear: number | null,
    public readonly employeeCount: string | null, // "1-5", "6-20", "21-50", "50+"
    public readonly website: string | null,
    public readonly address: string | null,
    public readonly city: string,
    public readonly zone: string | null,
    public readonly status: CompanyStatus,
    public readonly profileImage: string | null,
    public readonly gallery: string[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    // Optional: the full ServiceProvider entity when needed
    public readonly serviceProvider?: ServiceProviderEntity,
    // Optional: attached user data
    public readonly user?: any,
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

  /**
   * Get the display name for the company
   */
  get displayName(): string {
    return this.companyName;
  }

  // ─────────────────────────────────────────────────────────────
  // Status Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if company has the VERIFIED status (special badge)
   */
  hasVerifiedBadge(): boolean {
    return this.status === CompanyStatus.VERIFIED;
  }

  isPending(): boolean {
    return this.status === CompanyStatus.PENDING_VERIFICATION;
  }

  isRejected(): boolean {
    return this.status === CompanyStatus.REJECTED;
  }

  isSuspended(): boolean {
    return this.status === CompanyStatus.SUSPENDED;
  }

  isInactive(): boolean {
    return this.status === CompanyStatus.INACTIVE;
  }

  /**
   * Check if the company profile can operate (express interest, receive requests, etc.)
   * Only ACTIVE or VERIFIED status allows operation.
   */
  canOperate(): boolean {
    return this.status === CompanyStatus.ACTIVE ||
           this.status === CompanyStatus.VERIFIED;
  }

  /**
   * Check if the company can be activated.
   * Can activate from PENDING, INACTIVE, or re-activate from ACTIVE/VERIFIED.
   */
  canBeActivated(): boolean {
    return this.status === CompanyStatus.PENDING_VERIFICATION ||
           this.status === CompanyStatus.INACTIVE ||
           this.status === CompanyStatus.ACTIVE ||
           this.status === CompanyStatus.VERIFIED;
  }

  /**
   * Check if the company can be deactivated.
   * Only ACTIVE or VERIFIED can be deactivated.
   */
  canBeDeactivated(): boolean {
    return this.status === CompanyStatus.ACTIVE ||
           this.status === CompanyStatus.VERIFIED;
  }

  /**
   * @deprecated Use canOperate() instead
   */
  isActive(): boolean {
    return this.canOperate();
  }

  /**
   * @deprecated Use canOperate() instead
   */
  isActiveAndVerified(): boolean {
    return this.canOperate();
  }

  // ─────────────────────────────────────────────────────────────
  // Authorization Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if the company profile is owned by the given user.
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
  canViewFullProfileBy(ctx: CompanyAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.isOwnedBy(ctx.userId);
  }

  /**
   * Check if user can edit this company profile.
   * - Only owner or admin can edit
   */
  canBeEditedBy(ctx: CompanyAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.isOwnedBy(ctx.userId);
  }

  /**
   * Check if user can manage gallery (add/remove items).
   * - Only owner or admin can manage gallery
   */
  canManageGalleryBy(ctx: CompanyAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.isOwnedBy(ctx.userId);
  }

  /**
   * Check if user can change the company status.
   * - Only admins can change status
   */
  canChangeStatusBy(ctx: CompanyAuthContext): boolean {
    return ctx.isAdmin;
  }

  // ─────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────

  static buildAuthContext(userId: string, isAdmin: boolean): CompanyAuthContext {
    return { userId, isAdmin };
  }

  /**
   * Create a new company entity with an associated service provider
   */
  withServiceProvider(serviceProvider: ServiceProviderEntity): CompanyEntity {
    return new CompanyEntity(
      this.id,
      this.userId,
      this.serviceProviderId,
      this.companyName,
      this.legalName,
      this.taxId,
      this.trades,
      this.description,
      this.foundedYear,
      this.employeeCount,
      this.website,
      this.address,
      this.city,
      this.zone,
      this.status,
      this.profileImage,
      this.gallery,
      this.createdAt,
      this.updatedAt,
      serviceProvider,
      this.user,
    );
  }
}
