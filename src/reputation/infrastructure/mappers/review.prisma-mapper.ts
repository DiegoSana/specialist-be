import { ReviewEntity } from '../../domain/entities/review.entity';

export class PrismaReviewMapper {
  static toDomain(review: any): ReviewEntity {
    const entity = new ReviewEntity(
      review.id,
      review.reviewerId,
      review.professionalId,
      review.requestId,
      review.rating,
      review.comment,
      review.createdAt,
      review.updatedAt,
    );

    if (review.reviewer) {
      (entity as any).reviewer = {
        id: review.reviewer.id,
        firstName: review.reviewer.firstName,
        lastName: review.reviewer.lastName,
        email: review.reviewer.email,
      };
    }

    return entity;
  }

  static toPersistenceCreate(input: {
    reviewerId: string;
    professionalId: string;
    rating: number;
    comment: string | null;
    requestId: string | null;
  }): Record<string, unknown> {
    return {
      reviewerId: input.reviewerId,
      professionalId: input.professionalId,
      requestId: input.requestId,
      rating: input.rating,
      comment: input.comment,
    };
  }

  static toPersistenceUpdate(input: {
    rating?: number;
    comment?: string | null;
  }): Record<string, unknown> {
    return {
      ...(input.rating !== undefined && { rating: input.rating }),
      ...(input.comment !== undefined && { comment: input.comment }),
    };
  }
}
