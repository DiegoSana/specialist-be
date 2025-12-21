import { UserStatus, AuthProvider } from '@prisma/client';

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

  isAdminUser(): boolean {
    return this.isAdmin;
  }

  canCreateProfessionalProfile(): boolean {
    return this.isActive();
  }

  canCreateRequest(): boolean {
    return this.hasClientProfile && this.isActive();
  }

  hasBothProfiles(): boolean {
    return this.hasClientProfile && this.hasProfessionalProfile;
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
      this.googleId,
      facebookId,
      this.authProvider,
    );
  }
}
