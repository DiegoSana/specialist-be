import { Injectable } from '@nestjs/common';
import {
  ReviewDirection,
  ReviewStatus as PrismaReviewStatus,
} from '@prisma/client';
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
    reviewee: {
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

  async findByServiceProviderId(
    serviceProviderId: string,
  ): Promise<ReviewEntity[]> {
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

  async findApprovedByRevieweeUserId(
    revieweeUserId: string,
    direction: ReviewDirection,
  ): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: {
        revieweeUserId,
        direction,
        status: PrismaReviewStatus.APPROVED,
      },
      include: this.includeReviewer,
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => PrismaReviewMapper.toDomain(r));
  }

  async findFeaturedByRevieweeUserId(
    revieweeUserId: string,
    direction: ReviewDirection,
    limit: number,
  ): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: {
        revieweeUserId,
        direction,
        status: PrismaReviewStatus.APPROVED,
        isFeatured: true,
      },
      include: this.includeReviewer,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return reviews.map((r) => PrismaReviewMapper.toDomain(r));
  }

  async findByRequestIdAndDirection(
    requestId: string,
    direction: ReviewDirection,
  ): Promise<ReviewEntity | null> {
    const review = await this.prisma.review.findUnique({
      where: { requestId_direction: { requestId, direction } },
      include: this.includeServiceProviderWithUser,
    });

    if (!review) return null;

    return PrismaReviewMapper.toDomain(review);
  }

  async findAllByRequestId(requestId: string): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: { requestId },
      include: this.includeServiceProviderWithUser,
    });

    return reviews.map((r) => PrismaReviewMapper.toDomain(r));
  }

  async findByStatus(status: ReviewStatus): Promise<ReviewEntity[]> {
    const reviews = await this.prisma.review.findMany({
      where: { status: status as PrismaReviewStatus },
      include: this.includeServiceProviderWithUser,
      orderBy: { createdAt: 'asc' },
    });

    return reviews.map((r) => PrismaReviewMapper.toDomain(r));
  }

  async findRequestIdsPendingReveal(): Promise<string[]> {
    const rows = await this.prisma.review.findMany({
      where: { status: PrismaReviewStatus.APPROVED, revealedAt: null },
      select: { requestId: true },
      distinct: ['requestId'],
    });
    return rows.map((r) => r.requestId);
  }

  async save(review: ReviewEntity): Promise<ReviewEntity> {
    const createData: any = {
      id: review.id,
      direction: review.direction,
      reviewerId: review.reviewerId,
      revieweeUserId: review.revieweeUserId,
      serviceProviderId: review.serviceProviderId,
      requestId: review.requestId,
      rating: review.rating,
      comment: review.comment,
      status: review.status,
      moderatedAt: review.moderatedAt,
      moderatedBy: review.moderatedBy,
      revealedAt: review.revealedAt,
      isFeatured: review.isFeatured,
    };

    const updateData = {
      rating: review.rating,
      comment: review.comment,
      status: review.status,
      moderatedAt: review.moderatedAt,
      moderatedBy: review.moderatedBy,
      revealedAt: review.revealedAt,
      isFeatured: review.isFeatured,
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
