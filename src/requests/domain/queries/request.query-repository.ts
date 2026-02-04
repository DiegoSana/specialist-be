/**
 * Request Query Repository
 * 
 * Handles read-only queries that return DTOs or statistics instead of domain entities.
 * Separated from RequestRepository (aggregate repository) to maintain clear boundaries.
 * 
 * See: docs/architecture/QUERY_REPOSITORIES.md
 */

import { RequestStatus } from '@prisma/client';

export type RequestStats = {
  total: number;
  byStatus: Record<string, number>;
  newLast7Days: number;
  newLast30Days: number;
};

export interface RequestQueryRepository {
  /**
   * Get request statistics for admin dashboard
   */
  getRequestStats(): Promise<RequestStats>;

  /**
   * List all requests for admin (paginated, with optional status filter)
   */
  findAllForAdmin(params: {
    skip: number;
    take: number;
    status?: RequestStatus;
  }): Promise<{
    requests: Array<{
      id: string;
      title: string;
      description: string;
      status: RequestStatus;
      createdAt: Date;
      client: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
      provider: {
        id: string;
      } | null;
      trade: {
        id: string;
        name: string;
      } | null;
    }>;
    total: number;
  }>;
}

// Token for dependency injection
export const REQUEST_QUERY_REPOSITORY = Symbol('RequestQueryRepository');

