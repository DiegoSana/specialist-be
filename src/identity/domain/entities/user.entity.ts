import { UserStatus, AuthProvider } from '@prisma/client';

export class UserEntity {
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
}

