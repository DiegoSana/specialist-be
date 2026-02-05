import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RequestQueryRepository, RequestStats } from '../../domain/queries/request.query-repository';
import { RequestStatus } from '@prisma/client';

@Injectable()
export class PrismaRequestQueryRepository implements RequestQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getRequestStats(): Promise<RequestStats> {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, requestsByStatus, newLast7Days, newLast30Days] =
      await Promise.all([
        this.prisma.request.count(),
        this.prisma.request.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        this.prisma.request.count({
          where: { createdAt: { gte: last7Days } },
        }),
        this.prisma.request.count({
          where: { createdAt: { gte: last30Days } },
        }),
      ]);

    // Build requests by status object
    const requestsByStatusMap: Record<string, number> = {
      PENDING: 0,
      ACCEPTED: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      CANCELLED: 0,
    };
    requestsByStatus.forEach((item) => {
      requestsByStatusMap[item.status] = item._count.status;
    });

    return {
      total,
      byStatus: requestsByStatusMap,
      newLast7Days,
      newLast30Days,
    };
  }

  async findAllForAdmin(params: {
    skip: number;
    take: number;
    status?: RequestStatus;
  }) {
    const where: any = {};
    if (params.status) {
      where.status = params.status;
    }

    const [requests, total] = await Promise.all([
      this.prisma.request.findMany({
        skip: params.skip,
        take: params.take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          provider: {
            select: {
              id: true,
            },
          },
          trade: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.request.count({ where }),
    ]);

    return { requests, total };
  }
}



