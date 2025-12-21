import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProfessionalRepository } from '../../domain/repositories/professional.repository';
import { ProfessionalEntity } from '../../domain/entities/professional.entity';
import { ProfessionalStatus } from '@prisma/client';
import { PrismaProfessionalMapper } from '../mappers/professional.prisma-mapper';

@Injectable()
export class PrismaProfessionalRepository implements ProfessionalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProfessionalEntity | null> {
    const professional = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        trades: {
          include: {
            trade: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    if (!professional) return null;

    return PrismaProfessionalMapper.toDomain(professional);
  }

  async findByUserId(userId: string): Promise<ProfessionalEntity | null> {
    const professional = await this.prisma.professional.findUnique({
      where: { userId },
      include: {
        trades: {
          include: {
            trade: true,
          },
        },
      },
    });

    if (!professional) return null;

    return PrismaProfessionalMapper.toDomain(professional);
  }

  async findByTradeId(tradeId: string): Promise<ProfessionalEntity[]> {
    const professionals = await this.prisma.professional.findMany({
      where: {
        trades: {
          some: {
            tradeId,
          },
        },
      },
      include: {
        trades: {
          include: {
            trade: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    return professionals.map((p) => PrismaProfessionalMapper.toDomain(p));
  }

  async search(criteria: {
    search?: string;
    tradeId?: string;
    active?: boolean;
  }): Promise<ProfessionalEntity[]> {
    const where: any = {};

    if (criteria.active !== undefined) {
      where.active = criteria.active;
      if (criteria.active) {
        where.status = ProfessionalStatus.VERIFIED;
      }
    }

    // Filter by trade ID if provided
    if (criteria.tradeId) {
      where.trades = {
        some: {
          tradeId: criteria.tradeId,
        },
      };
    }

    // Search by trade name or professional name
    if (criteria.search && criteria.search.trim()) {
      const searchTerm = criteria.search.trim();
      const searchConditions: any[] = [
        // Search in user first name or last name
        {
          user: {
            OR: [
              { firstName: { contains: searchTerm, mode: 'insensitive' } },
              { lastName: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        },
        // Search in trade names
        {
          trades: {
            some: {
              trade: {
                name: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          },
        },
      ];

      // If tradeId is also provided, combine with AND
      if (criteria.tradeId) {
        where.AND = [
          { trades: { some: { tradeId: criteria.tradeId } } },
          { OR: searchConditions },
        ];
      } else {
        where.OR = searchConditions;
      }
    }

    const professionals = await this.prisma.professional.findMany({
      where,
      include: {
        trades: {
          include: {
            trade: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { averageRating: 'desc' },
    });

    return professionals.map((p) => PrismaProfessionalMapper.toDomain(p));
  }

  async save(professional: ProfessionalEntity): Promise<ProfessionalEntity> {
    const tradeIds = professional.tradeIds;

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.professional.findUnique({
        where: { id: professional.id },
        select: { id: true },
      });

      if (!existing) {
        return tx.professional.create({
          data: {
            id: professional.id,
            userId: professional.userId,
            description: professional.description,
            experienceYears: professional.experienceYears,
            status: professional.status,
            zone: professional.zone,
            city: professional.city,
            address: professional.address,
            whatsapp: professional.whatsapp,
            website: professional.website,
            averageRating: professional.averageRating,
            totalReviews: professional.totalReviews,
            profileImage: professional.profileImage,
            gallery: professional.gallery,
            active: professional.active,
            trades: PrismaProfessionalMapper.toPersistenceTrades(tradeIds),
          },
          include: {
            trades: { include: { trade: true } },
          },
        });
      }

      // Update scalars
      await tx.professional.update({
        where: { id: professional.id },
        data: {
          description: professional.description,
          experienceYears: professional.experienceYears,
          status: professional.status,
          zone: professional.zone,
          city: professional.city,
          address: professional.address,
          whatsapp: professional.whatsapp,
          website: professional.website,
          averageRating: professional.averageRating,
          totalReviews: professional.totalReviews,
          profileImage: professional.profileImage,
          gallery: professional.gallery,
          active: professional.active,
        },
      });

      // Sync trades (source of truth = aggregate)
      await tx.professionalTrade.deleteMany({
        where: { professionalId: professional.id },
      });
      await tx.professionalTrade.createMany({
        data: tradeIds.map((tradeId, index) => ({
          professionalId: professional.id,
          tradeId,
          isPrimary: index === 0,
        })),
        skipDuplicates: true,
      });

      return tx.professional.findUniqueOrThrow({
        where: { id: professional.id },
        include: {
          trades: { include: { trade: true } },
        },
      });
    });

    return PrismaProfessionalMapper.toDomain(result);
  }

  async updateRating(
    id: string,
    averageRating: number,
    totalReviews: number,
  ): Promise<void> {
    await this.prisma.professional.update({
      where: { id },
      data: {
        averageRating,
        totalReviews,
      },
    });
  }
}
