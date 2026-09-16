/**
 * User Query Repository
 *
 * Handles read-only queries that return DTOs or statistics instead of domain entities.
 * Separated from UserRepository (aggregate repository) to maintain clear boundaries.
 *
 * See: docs/architecture/QUERY_REPOSITORIES.md
 */

export type UserStats = {
  total: number;
  newLast7Days: number;
  newLast30Days: number;
  activeLast30Days: number;
};

export interface UserQueryRepository {
  /**
   * Get user statistics for admin dashboard
   */
  getUserStats(): Promise<UserStats>;

  /**
   * List all users for admin (paginated, optional email/firstName/lastName search)
   */
  findAllForAdmin(params: {
    skip: number;
    take: number;
    search?: string;
  }): Promise<{
    users: Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      isAdmin: boolean;
      hasClientProfile: boolean;
      hasProfessionalProfile: boolean;
      hasCompanyProfile: boolean;
    }>;
    total: number;
  }>;
}

// Token for dependency injection
export const USER_QUERY_REPOSITORY = Symbol('UserQueryRepository');
