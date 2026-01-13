import { ReviewEntity } from '../../domain/entities/review.entity';
import { ReviewStatus } from '../../domain/value-objects/review-status';

export class PrismaReviewMapper {
  static toDomain(review: any): ReviewEntity {
    const entity = new ReviewEntity(
      review.id,
      review.reviewerId,
      review.serviceProviderId,
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

    // Map ServiceProvider with professional or company data
    if (review.serviceProvider) {
      (entity as any).serviceProvider = {
        id: review.serviceProvider.id,
        type: review.serviceProvider.type,
        averageRating: review.serviceProvider.averageRating,
        totalReviews: review.serviceProvider.totalReviews,
      };

      // If it's a professional provider
      if (review.serviceProvider.professional?.user) {
        (entity as any).professional = {
          id: review.serviceProvider.professional.id,
          userId: review.serviceProvider.professional.userId,
          user: {
            id: review.serviceProvider.professional.user.id,
            firstName: review.serviceProvider.professional.user.firstName,
            lastName: review.serviceProvider.professional.user.lastName,
            email: review.serviceProvider.professional.user.email,
          },
        };
      }

      // If it's a company provider
      if (review.serviceProvider.company?.user) {
        (entity as any).company = {
          id: review.serviceProvider.company.id,
          userId: review.serviceProvider.company.userId,
          companyName: review.serviceProvider.company.companyName,
          user: {
            id: review.serviceProvider.company.user.id,
            firstName: review.serviceProvider.company.user.firstName,
            lastName: review.serviceProvider.company.user.lastName,
            email: review.serviceProvider.company.user.email,
          },
        };
      }
    }

    return entity;
  }

  static toPersistenceCreate(input: {
    reviewerId: string;
    serviceProviderId: string;
    rating: number;
    comment: string | null;
    requestId: string;
    status?: ReviewStatus;
  }): Record<string, unknown> {
    return {
      reviewerId: input.reviewerId,
      serviceProviderId: input.serviceProviderId,
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
