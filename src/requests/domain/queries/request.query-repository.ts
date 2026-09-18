/**
 * Request Query Repository
 *
 * Handles read-only queries that return DTOs or statistics instead of domain entities.
 * Separated from RequestRepository (aggregate repository) to maintain clear boundaries.
 *
 * See: docs/architecture/QUERY_REPOSITORIES.md
 */

import { RequestStatus, ProviderType } from '@prisma/client';

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
   * List all requests for admin (paginated). Optional filters: status, title,
   * client (name/email) and provider (professional name / company name); free-text
   * ones are case-insensitive and every whitespace-separated term must match.
   */
  findAllForAdmin(params: {
    skip: number;
    take: number;
    status?: RequestStatus;
    title?: string;
    client?: string;
    provider?: string;
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
        type: ProviderType;
        name: string;
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
