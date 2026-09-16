import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  UserQueryRepository,
  UserStats,
} from '../../domain/queries/user.query-repository';
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
    search?: string;
    type?: 'CLIENT' | 'PROFESSIONAL' | 'COMPANY';
  }): Promise<{
    users: Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      isAdmin: boolean;
      hasClientProfile: boolean;
      hasProfessionalProfile: boolean;
      hasCompanyProfile: boolean;
    }>;
    total: number;
  }> {
    const search = params.search?.trim();
    const where: any = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    if (params.type === 'CLIENT') {
      where.client = { isNot: null };
    } else if (params.type === 'PROFESSIONAL') {
      where.professional = { isNot: null };
    } else if (params.type === 'COMPANY') {
      where.company = { isNot: null };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: params.skip,
        take: params.take,
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          isAdmin: true,
          createdAt: true,
          updatedAt: true,
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
          company: {
            select: {
              id: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        isAdmin: u.isAdmin,
        hasClientProfile: !!u.client,
        hasProfessionalProfile: !!u.professional,
        hasCompanyProfile: !!u.company,
      })),
      total,
    };
  }
}
