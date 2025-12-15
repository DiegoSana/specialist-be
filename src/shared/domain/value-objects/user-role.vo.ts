/**
 * Value Object for UserRole
 * Note: UserRole now only contains ADMIN.
 * Client and Professional roles are determined by profile existence.
 */
export enum UserRole {
  ADMIN = 'ADMIN',
}

export class UserRoleVO {
  constructor(private readonly value: UserRole | null) {}

  getValue(): UserRole | null {
    return this.value;
  }

  isAdmin(): boolean {
    return this.value === UserRole.ADMIN;
  }

  /**
   * @deprecated Use profile checks instead. This always returns false now.
   */
  isProfessional(): boolean {
    return false; // Professional is determined by profile existence, not role
  }

  /**
   * @deprecated Use profile checks instead. This always returns false now.
   */
  isClient(): boolean {
    return false; // Client is determined by profile existence, not role
  }

  canAccessAdminPanel(): boolean {
    return this.isAdmin();
  }
}
