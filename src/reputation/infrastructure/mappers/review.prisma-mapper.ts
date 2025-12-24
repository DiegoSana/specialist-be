import { ReviewEntity } from '../../domain/entities/review.entity';
import { ReviewStatus } from '../../domain/value-objects/review-status';

export class PrismaReviewMapper {
  static toDomain(review: any): ReviewEntity {
    const entity = new ReviewEntity(
      review.id,
      review.reviewerId,
      review.professionalId,
      review.requestId,
      review.rating,
      review.comment,
      review.status as ReviewStatus,
      review.moderatedAt,
      review.moderatedBy,
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

    if (review.professional?.user) {
      (entity as any).professional = {
        id: review.professional.id,
        userId: review.professional.userId,
        user: {
          id: review.professional.user.id,
          firstName: review.professional.user.firstName,
          lastName: review.professional.user.lastName,
          email: review.professional.user.email,
        },
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
    status?: ReviewStatus;
  }): Record<string, unknown> {
    return {
      reviewerId: input.reviewerId,
      professionalId: input.professionalId,
      requestId: input.requestId,
      rating: input.rating,
      comment: input.comment,
      status: input.status ?? ReviewStatus.PENDING,
    };
  }

  static toPersistenceUpdate(input: {
    rating?: number;
    comment?: string | null;
    status?: ReviewStatus;
    moderatedAt?: Date;
    moderatedBy?: string;
  }): Record<string, unknown> {
    return {
      ...(input.rating !== undefined && { rating: input.rating }),
      ...(input.comment !== undefined && { comment: input.comment }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.moderatedAt !== undefined && { moderatedAt: input.moderatedAt }),
      ...(input.moderatedBy !== undefined && { moderatedBy: input.moderatedBy }),
    };
  }
}
