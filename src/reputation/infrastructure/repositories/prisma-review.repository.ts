import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ReviewRepository } from '../../domain/repositories/review.repository';
import { ReviewEntity } from '../../domain/entities/review.entity';

@Injectable()
export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ReviewEntity | null> {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) return null;

    return this.toEntity(review);
  }

  async findByProfessionalId(professionalId: string): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: { professionalId },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => this.toEntity(r));
  }

  async findByRequestId(requestId: string): Promise<ReviewEntity | null> {
    const review = await this.prisma.review.findUnique({
      where: { requestId },
    });

    if (!review) return null;

    return this.toEntity(review);
  }

  async create(
    reviewData: {
      reviewerId: string;
      professionalId: string;
      rating: number;
      comment: string | null;
      requestId: string | null;
    },
  ): Promise<ReviewEntity> {
    const review = await this.prisma.review.create({
      data: {
        reviewerId: reviewData.reviewerId,
        professionalId: reviewData.professionalId,
        requestId: reviewData.requestId,
        rating: reviewData.rating,
        comment: reviewData.comment,
      },
    });

    return this.toEntity(review);
  }

  async update(
    id: string,
    data: {
      rating?: number;
      comment?: string | null;
    },
  ): Promise<ReviewEntity> {
    const review = await this.prisma.review.update({
      where: { id },
      data: {
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.comment !== undefined && { comment: data.comment }),
      },
    });

    return this.toEntity(review);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.review.delete({
      where: { id },
    });
  }

  private toEntity(review: any): ReviewEntity {
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

    // Attach reviewer data if available (for API responses)
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
}

