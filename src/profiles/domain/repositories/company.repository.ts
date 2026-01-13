import { CompanyEntity } from '../entities/company.entity';

export interface CompanySearchParams {
  search?: string;
  tradeId?: string;
  city?: string;
  verified?: boolean;
  active?: boolean;
}

export interface CompanyRepository {
  findById(id: string): Promise<CompanyEntity | null>;
  findByUserId(userId: string): Promise<CompanyEntity | null>;
  findByServiceProviderId(serviceProviderId: string): Promise<CompanyEntity | null>;
  search(params: CompanySearchParams): Promise<CompanyEntity[]>;
  save(company: CompanyEntity): Promise<CompanyEntity>;
  delete(id: string): Promise<void>;
}

// Token for dependency injection
export const COMPANY_REPOSITORY = Symbol('CompanyRepository');

