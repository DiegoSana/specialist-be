import { CompanyEntity, CompanyStatus } from '../entities/company.entity';

export interface CompanySearchParams {
  search?: string;
  tradeId?: string;
  city?: string;
  verified?: boolean;
  /** When true, only return companies that can operate (status ACTIVE or VERIFIED). */
  canOperate?: boolean;
  /** When true, only return companies whose user has emailVerified and phoneVerified (catalog "active" provider). */
  userVerified?: boolean;
}

export interface CompanyRepository {
  findById(id: string): Promise<CompanyEntity | null>;
  findByUserId(userId: string): Promise<CompanyEntity | null>;
  findByServiceProviderId(serviceProviderId: string): Promise<CompanyEntity | null>;
  findByTaxId(taxId: string): Promise<CompanyEntity | null>;
  search(params: CompanySearchParams): Promise<CompanyEntity[]>;
  save(company: CompanyEntity): Promise<CompanyEntity>;
  delete(id: string): Promise<void>;

  /**
   * Update the status of a company profile.
   * Used for profile activation/deactivation.
   */
  updateStatus(id: string, status: CompanyStatus): Promise<CompanyEntity>;
}

// Token for dependency injection
export const COMPANY_REPOSITORY = Symbol('CompanyRepository');

