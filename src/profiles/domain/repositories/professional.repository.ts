import { ProfessionalEntity } from '../entities/professional.entity';
import { ProfessionalStatus } from '@prisma/client';

export interface ProfessionalRepository {
  findById(id: string): Promise<ProfessionalEntity | null>;
  findByUserId(userId: string): Promise<ProfessionalEntity | null>;
  findByTradeId(tradeId: string): Promise<ProfessionalEntity[]>;
  search(criteria: {
    search?: string;
    tradeId?: string;
    active?: boolean;
  }): Promise<ProfessionalEntity[]>;
  create(professional: {
    userId: string;
    tradeIds: string[];
    description: string | null;
    experienceYears: number | null;
    status: ProfessionalStatus;
    zone: string | null;
    city: string;
    address: string | null;
    whatsapp: string | null;
    website: string | null;
    profileImage: string | null;
    gallery: string[];
    active: boolean;
  }): Promise<ProfessionalEntity>;
  update(id: string, data: Partial<ProfessionalEntity> & { tradeIds?: string[] }): Promise<ProfessionalEntity>;
  updateRating(id: string, averageRating: number, totalReviews: number): Promise<void>;
}

// Token for dependency injection
export const PROFESSIONAL_REPOSITORY = Symbol('ProfessionalRepository');
