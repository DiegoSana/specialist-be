/**
 * Company Query Repository
 * 
 * Handles read-only queries that return DTOs or statistics instead of domain entities.
 * Separated from CompanyRepository (aggregate repository) to maintain clear boundaries.
 * 
 * See: docs/architecture/QUERY_REPOSITORIES.md
 */

import { CompanyStatus as PrismaCompanyStatus } from '@prisma/client';

export type CompanyStats = {
  total: number;
  verified: number;
  pending: number;
  suspended: number;
};

export interface CompanyQueryRepository {
  /**
   * Get company statistics for admin dashboard
   */
  getCompanyStats(): Promise<CompanyStats>;

  /**
   * List all companies for admin (paginated)
   */
  findAllForAdmin(params: {
    skip: number;
    take: number;
  }): Promise<{
    companies: Array<{
      id: string;
      createdAt: Date;
      status: PrismaCompanyStatus;
      companyName: string;
      taxId: string | null;
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
   * Find company by ID for admin (with full details)
   */
  findByIdForAdmin(id: string): Promise<{
    id: string;
    createdAt: Date;
    status: PrismaCompanyStatus;
    companyName: string;
    taxId: string | null;
    description: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    website: string | null;
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
export const COMPANY_QUERY_REPOSITORY = Symbol('CompanyQueryRepository');



