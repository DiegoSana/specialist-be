/**
 * Professional Query Repository
 * 
 * Handles read-only queries that return DTOs or statistics instead of domain entities.
 * Separated from ProfessionalRepository (aggregate repository) to maintain clear boundaries.
 * 
 * See: docs/architecture/QUERY_REPOSITORIES.md
 */

import { ProfessionalStatus } from '@prisma/client';

export type ProfessionalStats = {
  total: number;
  verified: number;
  pending: number;
  suspended: number;
};

export interface ProfessionalQueryRepository {
  /**
   * Get professional statistics for admin dashboard
   */
  getProfessionalStats(): Promise<ProfessionalStats>;

  /**
   * List all professionals for admin (paginated)
   */
  findAllForAdmin(params: {
    skip: number;
    take: number;
  }): Promise<{
    professionals: Array<{
      id: string;
      createdAt: Date;
      status: ProfessionalStatus;
      user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
      trades: Array<{
        trade: {
          id: string;
          name: string;
        };
      }>;
    }>;
    total: number;
  }>;

  /**
   * Find professional by ID for admin (with full details)
   */
  findByIdForAdmin(id: string): Promise<{
    id: string;
    createdAt: Date;
    status: ProfessionalStatus;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      status: string;
    };
    trades: Array<{
      trade: {
        id: string;
        name: string;
      };
    }>;
    serviceProvider: {
      id: string;
      averageRating: number;
      totalReviews: number;
    };
  } | null>;
}

// Token for dependency injection
export const PROFESSIONAL_QUERY_REPOSITORY = Symbol('ProfessionalQueryRepository');


