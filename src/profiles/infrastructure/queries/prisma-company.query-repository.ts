import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CompanyQueryRepository, CompanyStats } from '../../domain/queries/company.query-repository';
import { CompanyStatus as PrismaCompanyStatus } from '@prisma/client';

@Injectable()
export class PrismaCompanyQueryRepository implements CompanyQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanyStats(): Promise<CompanyStats> {
    const [total, verified, pending, suspended] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({
        where: {
          status: {
            in: [PrismaCompanyStatus.ACTIVE, PrismaCompanyStatus.VERIFIED],
          },
        },
      }),
      this.prisma.company.count({
        where: { status: PrismaCompanyStatus.PENDING_VERIFICATION },
      }),
      this.prisma.company.count({
        where: { status: PrismaCompanyStatus.SUSPENDED },
      }),
    ]);

    return {
      total,
      verified,
      pending,
      suspended,
    };
  }

  async findAllForAdmin(params: {
    skip: number;
    take: number;
  }) {
    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          trades: {
            include: {
              trade: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.company.count(),
    ]);

    return { companies, total };
  }

  async findByIdForAdmin(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
          },
        },
        trades: {
          include: {
            trade: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        serviceProvider: {
          select: {
            id: true,
            averageRating: true,
            totalReviews: true,
          },
        },
      },
    });

    return company;
  }
}

