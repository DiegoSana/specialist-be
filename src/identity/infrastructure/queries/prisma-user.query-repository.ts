import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UserQueryRepository, UserStats } from '../../domain/queries/user.query-repository';
import { UserStatus } from '@prisma/client';

@Injectable()
export class PrismaUserQueryRepository implements UserQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserStats(): Promise<UserStats> {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, newLast7Days, newLast30Days, activeLast30Days] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({
          where: { createdAt: { gte: last7Days } },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: last30Days } },
        }),
        this.prisma.user.count({
          where: {
            status: UserStatus.ACTIVE,
            updatedAt: { gte: last30Days },
          },
        }),
      ]);

    return {
      total,
      newLast7Days,
      newLast30Days,
      activeLast30Days,
    };
  }

  async findAllForAdmin(params: {
    skip: number;
    take: number;
  }): Promise<{
    users: Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
      createdAt: Date;
      client: { id: string } | null;
      professional: { id: string } | null;
    }>;
    total: number;
  }> {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          client: {
            select: {
              id: true,
            },
          },
          professional: {
            select: {
              id: true,
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);

    return { users, total };
  }
}



