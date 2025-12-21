import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ReviewRepository } from '../../domain/repositories/review.repository';
import { ReviewEntity } from '../../domain/entities/review.entity';
import { PrismaReviewMapper } from '../mappers/review.prisma-mapper';

@Injectable()
export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ReviewEntity | null> {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) return null;

    return PrismaReviewMapper.toDomain(review);
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

    return reviews.map((r) => PrismaReviewMapper.toDomain(r));
  }

  async findByRequestId(requestId: string): Promise<ReviewEntity | null> {
    const review = await this.prisma.review.findUnique({
      where: { requestId },
    });

    if (!review) return null;

    return PrismaReviewMapper.toDomain(review);
  }

  async create(reviewData: {
    reviewerId: string;
    professionalId: string;
    rating: number;
    comment: string | null;
    requestId: string | null;
  }): Promise<ReviewEntity> {
    const review = await this.prisma.review.create({
      data: {
        ...PrismaReviewMapper.toPersistenceCreate(reviewData),
      },
    });

    return PrismaReviewMapper.toDomain(review);
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
        ...PrismaReviewMapper.toPersistenceUpdate(data),
      },
    });

    return PrismaReviewMapper.toDomain(review);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.review.delete({
      where: { id },
    });
  }
}
