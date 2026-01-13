import { ProfessionalStatus } from '@prisma/client';

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
    public readonly trades: TradeInfo[],
    public readonly description: string | null,
    public readonly experienceYears: number | null,
    public readonly status: ProfessionalStatus,
    public readonly zone: string | null,
    public readonly city: string,
    public readonly address: string | null,
    public readonly whatsapp: string | null,
    public readonly website: string | null,
    public readonly averageRating: number,
    public readonly totalReviews: number,
    public readonly profileImage: string | null,
    public readonly gallery: string[],
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

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

  isVerified(): boolean {
    return this.status === ProfessionalStatus.VERIFIED;
  }

  isPending(): boolean {
    return this.status === ProfessionalStatus.PENDING_VERIFICATION;
  }

  isActive(): boolean {
    return this.active && this.isVerified();
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
}
