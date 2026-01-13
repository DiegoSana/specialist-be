import { ProfessionalEntity } from '../entities/professional.entity';

export interface ProfessionalRepository {
  findById(id: string): Promise<ProfessionalEntity | null>;
  findByUserId(userId: string): Promise<ProfessionalEntity | null>;
  findByServiceProviderId(serviceProviderId: string): Promise<ProfessionalEntity | null>;
  
  /**
   * Queries (read-model). En una separación más estricta, esto viviría
   * en un "ProfessionalQueryRepository" fuera del contrato de aggregate.
   */
  findByTradeId(tradeId: string): Promise<ProfessionalEntity[]>;
  search(criteria: {
    search?: string;
    tradeId?: string;
    active?: boolean;
  }): Promise<ProfessionalEntity[]>;

  /**
   * Opción A (colección de agregados): persistir el aggregate completo.
   * La implementación se encarga de create vs update.
   */
  save(professional: ProfessionalEntity): Promise<ProfessionalEntity>;

  /**
   * Update rating on the ServiceProvider associated with this professional.
   * The rating data lives on ServiceProvider, not Professional.
   */
  updateRating(
    id: string,
    averageRating: number,
    totalReviews: number,
  ): Promise<void>;
}

// Token for dependency injection
export const PROFESSIONAL_REPOSITORY = Symbol('ProfessionalRepository');
