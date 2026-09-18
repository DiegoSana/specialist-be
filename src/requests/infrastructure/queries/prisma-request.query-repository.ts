import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  RequestQueryRepository,
  RequestStats,
} from '../../domain/queries/request.query-repository';
import { RequestStatus, ProviderType } from '@prisma/client';

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
    title?: string;
    client?: string;
    provider?: string;
  }) {
    const where: any = {};
    if (params.status) {
      where.status = params.status;
    }
    if (params.title) {
      where.title = { contains: params.title, mode: 'insensitive' };
    }
    const clientTerms = this.splitTerms(params.client);
    if (clientTerms.length) {
      where.client = {
        AND: clientTerms.map((term) => ({
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        })),
      };
    }
    const providerTerms = this.splitTerms(params.provider);
    if (providerTerms.length) {
      where.provider = {
        AND: providerTerms.map((term) => ({
          OR: [
            {
              professional: {
                user: {
                  OR: [
                    { firstName: { contains: term, mode: 'insensitive' } },
                    { lastName: { contains: term, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              company: {
                companyName: { contains: term, mode: 'insensitive' },
              },
            },
          ],
        })),
      };
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
              type: true,
              professional: {
                select: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
              company: {
                select: { companyName: true },
              },
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

    return {
      requests: requests.map((request) => ({
        ...request,
        provider: this.resolveProvider(request.provider),
      })),
      total,
    };
  }

  private splitTerms(value?: string): string[] {
    return (value ?? '').split(/\s+/).filter(Boolean);
  }

  private resolveProvider(
    provider: any,
  ): { id: string; type: ProviderType; name: string } | null {
    if (!provider) return null;

    if (provider.professional?.user) {
      const user = provider.professional.user;
      return {
        id: provider.id,
        type: provider.type,
        name: `${user.firstName} ${user.lastName}`.trim(),
      };
    }

    if (provider.company) {
      return {
        id: provider.id,
        type: provider.type,
        name: provider.company.companyName,
      };
    }

    return null;
  }
}
