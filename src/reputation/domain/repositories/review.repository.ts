import { ReviewEntity } from '../entities/review.entity';
import { ReviewStatus } from '../value-objects/review-status';

export interface ReviewRepository {
  findById(id: string): Promise<ReviewEntity | null>;
  findByProfessionalId(professionalId: string): Promise<ReviewEntity[]>;
  findApprovedByProfessionalId(professionalId: string): Promise<ReviewEntity[]>;
  findByRequestId(requestId: string): Promise<ReviewEntity | null>;
  findByStatus(status: ReviewStatus): Promise<ReviewEntity[]>;

  /**
   * Opción A (colección de agregados): persiste el aggregate completo.
   * La implementación se encarga de create vs update.
   */
  save(review: ReviewEntity): Promise<ReviewEntity>;

  delete(id: string): Promise<void>;
}

// Token for dependency injection
export const REVIEW_REPOSITORY = Symbol('ReviewRepository');
