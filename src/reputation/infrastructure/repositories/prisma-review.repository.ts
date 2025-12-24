import { Injectable } from '@nestjs/common';
import { ReviewStatus as PrismaReviewStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ReviewRepository } from '../../domain/repositories/review.repository';
import { ReviewEntity } from '../../domain/entities/review.entity';
import { ReviewStatus } from '../../domain/value-objects/review-status';
import { PrismaReviewMapper } from '../mappers/review.prisma-mapper';

@Injectable()
export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeReviewer = {
    reviewer: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    },
  } as const;

  private readonly includeProfessionalWithUser = {
    ...this.includeReviewer,
    professional: {
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    },
  } as const;

  async findById(id: string): Promise<ReviewEntity | null> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: this.includeProfessionalWithUser,
    });

    if (!review) return null;

    return PrismaReviewMapper.toDomain(review);
  }

  async findByProfessionalId(professionalId: string): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: { professionalId },
      include: this.includeReviewer,
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => PrismaReviewMapper.toDomain(r));
  }

  async findApprovedByProfessionalId(
    professionalId: string,
  ): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: {
        professionalId,
        status: PrismaReviewStatus.APPROVED,
      },
      include: this.includeReviewer,
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

  async findByStatus(status: ReviewStatus): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: { status: status as PrismaReviewStatus },
      include: this.includeProfessionalWithUser,
      orderBy: { createdAt: 'asc' },
    });

    return reviews.map((r) => PrismaReviewMapper.toDomain(r));
  }

  async save(review: ReviewEntity): Promise<ReviewEntity> {
    const createData: any = {
      id: review.id,
      reviewerId: review.reviewerId,
      professionalId: review.professionalId,
      requestId: review.requestId,
      rating: review.rating,
      comment: review.comment,
      status: review.status,
      moderatedAt: review.moderatedAt,
      moderatedBy: review.moderatedBy,
    };

    const updateData = {
      rating: review.rating,
      comment: review.comment,
      status: review.status,
      moderatedAt: review.moderatedAt,
      moderatedBy: review.moderatedBy,
    };

    const saved = await this.prisma.review.upsert({
      where: { id: review.id },
      create: createData,
      update: updateData,
      include: this.includeProfessionalWithUser,
    });

    return PrismaReviewMapper.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.review.delete({
      where: { id },
    });
  }
}
