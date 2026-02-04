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
   * List all users for admin (paginated)
   */
  findAllForAdmin(params: {
    skip: number;
    take: number;
  }): Promise<{
    users: Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
      createdAt: Date;
      client: { id: string } | null;
      professional: { id: string } | null;
    }>;
    total: number;
  }>;
}

// Token for dependency injection
export const USER_QUERY_REPOSITORY = Symbol('UserQueryRepository');


