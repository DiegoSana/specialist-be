import { ReviewEntity } from '../entities/review.entity';

export interface ReviewRepository {
  findById(id: string): Promise<ReviewEntity | null>;
  findByProfessionalId(professionalId: string): Promise<ReviewEntity[]>;
  findByRequestId(requestId: string): Promise<ReviewEntity | null>;
  create(review: {
    reviewerId: string;
    professionalId: string;
    rating: number;
    comment: string | null;
    requestId: string | null;
  }): Promise<ReviewEntity>;
  update(id: string, data: {
    rating?: number;
    comment?: string | null;
  }): Promise<ReviewEntity>;
  delete(id: string): Promise<void>;
}

// Token for dependency injection
export const REVIEW_REPOSITORY = Symbol('ReviewRepository');
