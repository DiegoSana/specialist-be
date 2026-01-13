import { UserStatus, AuthProvider } from '@prisma/client';

/**
 * Authorization context for user operations.
 */
export interface UserAuthContext {
  userId: string;
  isAdmin: boolean;
}

export class UserEntity {
  static createLocal(params: {
    id: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    status?: UserStatus;
    now?: Date;
  }): UserEntity {
    const now = params.now ?? new Date();
    return new UserEntity(
      params.id,
      params.email,
      params.password,
      params.firstName,
      params.lastName,
      params.phone ?? null,
      null,
      false,
      params.status ?? UserStatus.PENDING,
      now,
      now,
      false,
      false,
      false,
      null,
      null,
      AuthProvider.LOCAL,
    );
  }

  static createOAuth(params: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profilePictureUrl: string | null;
    provider: Exclude<AuthProvider, 'LOCAL'>;
    externalId: string;
    status?: UserStatus;
    now?: Date;
  }): UserEntity {
    const now = params.now ?? new Date();
    return new UserEntity(
      params.id,
      params.email,
      null,
      params.firstName,
      params.lastName,
      null,
      params.profilePictureUrl,
      false,
      params.status ?? UserStatus.ACTIVE,
      now,
      now,
      false,
      false,
      false,
      params.provider === AuthProvider.GOOGLE ? params.externalId : null,
      params.provider === AuthProvider.FACEBOOK ? params.externalId : null,
      params.provider,
    );
  }

  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly password: string | null,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly phone: string | null,
    public readonly profilePictureUrl: string | null,
    public readonly isAdmin: boolean,
    public readonly status: UserStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly hasClientProfile: boolean = false,
    public readonly hasProfessionalProfile: boolean = false,
    public readonly hasCompanyProfile: boolean = false,
    public readonly googleId: string | null = null,
    public readonly facebookId: string | null = null,
    public readonly authProvider: AuthProvider = AuthProvider.LOCAL,
  ) {}

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  isClient(): boolean {
    return this.hasClientProfile;
  }

  isProfessional(): boolean {
    return this.hasProfessionalProfile;
  }

  isCompany(): boolean {
    return this.hasCompanyProfile;
  }

  /**
   * Check if user is any type of service provider
   */
  isServiceProvider(): boolean {
    return this.hasProfessionalProfile || this.hasCompanyProfile;
  }

  isAdminUser(): boolean {
    return this.isAdmin;
  }

  canCreateProfessionalProfile(): boolean {
    return this.isActive();
  }

  canCreateCompanyProfile(): boolean {
    return this.isActive();
  }

  canCreateRequest(): boolean {
    return this.hasClientProfile && this.isActive();
  }

  hasBothProfiles(): boolean {
    return this.hasClientProfile && this.hasProfessionalProfile;
  }

  hasAnyProviderProfile(): boolean {
    return this.hasProfessionalProfile || this.hasCompanyProfile;
  }

  withUpdatedProfile(input: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    profilePictureUrl?: string | null;
    now?: Date;
  }): UserEntity {
    const now = input.now ?? new Date();
    return new UserEntity(
      this.id,
      this.email,
      this.password,
      input.firstName !== undefined ? input.firstName : this.firstName,
      input.lastName !== undefined ? input.lastName : this.lastName,
      input.phone !== undefined ? input.phone : this.phone,
      input.profilePictureUrl !== undefined
        ? input.profilePictureUrl
        : this.profilePictureUrl,
      this.isAdmin,
      this.status,
      this.createdAt,
      now,
      this.hasClientProfile,
      this.hasProfessionalProfile,
      this.hasCompanyProfile,
      this.googleId,
      this.facebookId,
      this.authProvider,
    );
  }

  withStatus(status: UserStatus, now: Date = new Date()): UserEntity {
    return new UserEntity(
      this.id,
      this.email,
      this.password,
      this.firstName,
      this.lastName,
      this.phone,
      this.profilePictureUrl,
      this.isAdmin,
      status,
      this.createdAt,
      now,
      this.hasClientProfile,
      this.hasProfessionalProfile,
      this.hasCompanyProfile,
      this.googleId,
      this.facebookId,
      this.authProvider,
    );
  }

  linkGoogle(
    googleId: string,
    profilePictureUrl?: string | null,
    now: Date = new Date(),
  ): UserEntity {
    return new UserEntity(
      this.id,
      this.email,
      this.password,
      this.firstName,
      this.lastName,
      this.phone,
      this.profilePictureUrl || profilePictureUrl || null,
      this.isAdmin,
      this.status,
      this.createdAt,
      now,
      this.hasClientProfile,
      this.hasProfessionalProfile,
      this.hasCompanyProfile,
      googleId,
      this.facebookId,
      this.authProvider,
    );
  }

  linkFacebook(
    facebookId: string,
    profilePictureUrl?: string | null,
    now: Date = new Date(),
  ): UserEntity {
    return new UserEntity(
      this.id,
      this.email,
      this.password,
      this.firstName,
      this.lastName,
      this.phone,
      this.profilePictureUrl || profilePictureUrl || null,
      this.isAdmin,
      this.status,
      this.createdAt,
      now,
      this.hasClientProfile,
      this.hasProfessionalProfile,
      this.hasCompanyProfile,
      this.googleId,
      facebookId,
      this.authProvider,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Authorization Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if this user is the same as the one in the context.
   */
  isSelf(ctx: UserAuthContext): boolean {
    return this.id === ctx.userId;
  }

  /**
   * Check if user can view this user's full profile.
   * - Self can always view own profile
   * - Admin can view any user's profile
   */
  canBeViewedBy(ctx: UserAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.isSelf(ctx);
  }

  /**
   * Check if user can edit this user's profile (name, phone, picture).
   * - Self can edit own profile
   * - Admin can edit any user's profile
   */
  canBeEditedBy(ctx: UserAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.isSelf(ctx);
  }

  /**
   * Check if user can change this user's status (ACTIVE, SUSPENDED, etc).
   * - Only admins can change user status
   * - Users cannot change their own status
   */
  canChangeStatusBy(ctx: UserAuthContext): boolean {
    return ctx.isAdmin;
  }

  /**
   * Check if user can delete/deactivate this account.
   * - Self can delete own account
   * - Admin can delete any account
   */
  canBeDeletedBy(ctx: UserAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.isSelf(ctx);
  }

  // ─────────────────────────────────────────────────────────────
  // Helper: Build AuthContext
  // ─────────────────────────────────────────────────────────────

  static buildAuthContext(userId: string, isAdmin: boolean): UserAuthContext {
    return { userId, isAdmin };
  }
}
