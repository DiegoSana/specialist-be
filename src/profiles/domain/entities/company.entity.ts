import { ServiceProviderEntity } from './service-provider.entity';
import { TradeInfo } from './professional.entity';

/**
 * Company verification status
 */
export enum CompanyStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
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
    public readonly description: string | null,
    public readonly foundedYear: number | null,
    public readonly employeeCount: string | null,
    public readonly website: string | null,
    public readonly phone: string | null,
    public readonly email: string | null,
    public readonly address: string | null,
    public readonly city: string,
    public readonly zone: string | null,
    public readonly status: CompanyStatus,
    public readonly profileImage: string | null,
    public readonly gallery: string[],
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly trades: TradeInfo[],
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

  /**
   * Get the display name for the company
   */
  get displayName(): string {
    return this.companyName;
  }

  // ─────────────────────────────────────────────────────────────
  // Status Methods
  // ─────────────────────────────────────────────────────────────

  isVerified(): boolean {
    return this.status === CompanyStatus.VERIFIED;
  }

  isPending(): boolean {
    return this.status === CompanyStatus.PENDING_VERIFICATION;
  }

  isActive(): boolean {
    return this.active && this.isVerified();
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
      this.description,
      this.foundedYear,
      this.employeeCount,
      this.website,
      this.phone,
      this.email,
      this.address,
      this.city,
      this.zone,
      this.status,
      this.profileImage,
      this.gallery,
      this.active,
      this.createdAt,
      this.updatedAt,
      this.trades,
      serviceProvider,
    );
  }
}

