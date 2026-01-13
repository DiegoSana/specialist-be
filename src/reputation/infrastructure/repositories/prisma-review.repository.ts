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

  private readonly includeServiceProviderWithUser = {
    ...this.includeReviewer,
    serviceProvider: {
      include: {
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
        company: {
          select: {
            id: true,
            userId: true,
            companyName: true,
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
      },
    },
  } as const;

  async findById(id: string): Promise<ReviewEntity | null> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: this.includeServiceProviderWithUser,
    });

    if (!review) return null;

    return PrismaReviewMapper.toDomain(review);
  }

  async findByServiceProviderId(serviceProviderId: string): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: { serviceProviderId },
      include: this.includeReviewer,
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => PrismaReviewMapper.toDomain(r));
  }

  async findApprovedByServiceProviderId(
    serviceProviderId: string,
  ): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: {
        serviceProviderId,
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
      include: this.includeServiceProviderWithUser,
      orderBy: { createdAt: 'asc' },
    });

    return reviews.map((r) => PrismaReviewMapper.toDomain(r));
  }

  async save(review: ReviewEntity): Promise<ReviewEntity> {
    const createData: any = {
      id: review.id,
      reviewerId: review.reviewerId,
      serviceProviderId: review.serviceProviderId,
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
      include: this.includeServiceProviderWithUser,
    });

    return PrismaReviewMapper.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.review.delete({
      where: { id },
    });
  }
}
