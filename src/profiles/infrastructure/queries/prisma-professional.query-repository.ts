import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProfessionalQueryRepository, ProfessionalStats } from '../../domain/queries/professional.query-repository';
import { ProfessionalStatus } from '@prisma/client';

@Injectable()
export class PrismaProfessionalQueryRepository implements ProfessionalQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getProfessionalStats(): Promise<ProfessionalStats> {
    const [total, verified, pending, suspended] = await Promise.all([
      this.prisma.professional.count(),
      this.prisma.professional.count({
        where: {
          status: {
            in: [ProfessionalStatus.ACTIVE, ProfessionalStatus.VERIFIED],
          },
        },
      }),
      this.prisma.professional.count({
        where: { status: ProfessionalStatus.PENDING_VERIFICATION },
      }),
      this.prisma.professional.count({
        where: { status: ProfessionalStatus.SUSPENDED },
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
    const [professionals, total] = await Promise.all([
      this.prisma.professional.findMany({
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
      this.prisma.professional.count(),
    ]);

    return { professionals, total };
  }

  async findByIdForAdmin(id: string) {
    const professional = await this.prisma.professional.findUnique({
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

    return professional;
  }
}

