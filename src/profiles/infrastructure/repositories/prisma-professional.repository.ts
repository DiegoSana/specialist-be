import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProfessionalRepository } from '../../domain/repositories/professional.repository';
import { ProfessionalEntity } from '../../domain/entities/professional.entity';
import { ProfessionalStatus } from '@prisma/client';
import { PrismaProfessionalMapper } from '../mappers/professional.prisma-mapper';

// Standard includes for professional queries
const standardIncludes = {
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
      phone: true,
      profilePictureUrl: true,
    },
  },
  serviceProvider: true,
};

@Injectable()
export class PrismaProfessionalRepository implements ProfessionalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProfessionalEntity | null> {
    const professional = await this.prisma.professional.findUnique({
      where: { id },
      include: standardIncludes,
    });

    if (!professional) return null;

    return PrismaProfessionalMapper.toDomain(professional);
  }

  async findByUserId(userId: string): Promise<ProfessionalEntity | null> {
    const professional = await this.prisma.professional.findUnique({
      where: { userId },
      include: standardIncludes,
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
      include: standardIncludes,
    });

    return professionals.map((p) => PrismaProfessionalMapper.toDomain(p));
  }

  async search(criteria: {
    search?: string;
    tradeId?: string;
    canOperate?: boolean;
    userVerified?: boolean;
  }): Promise<ProfessionalEntity[]> {
    const where: any = {};

    if (criteria.canOperate !== undefined && criteria.canOperate) {
      where.status = {
        in: [ProfessionalStatus.ACTIVE, ProfessionalStatus.VERIFIED],
      };
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

    // Catalog "active" = profile can operate + user email and phone verified
    const finalWhere = criteria.userVerified
      ? {
          AND: [
            { user: { emailVerified: true, phoneVerified: true } },
            where,
          ],
        }
      : where;

    const professionals = await this.prisma.professional.findMany({
      where: finalWhere,
      include: standardIncludes,
      orderBy: { serviceProvider: { averageRating: 'desc' } },
    });

    return professionals.map((p) => PrismaProfessionalMapper.toDomain(p));
  }

  async save(professional: ProfessionalEntity): Promise<ProfessionalEntity> {
    const tradeIds = professional.tradeIds;

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.professional.findUnique({
        where: { id: professional.id },
        select: { id: true, serviceProviderId: true },
      });

      if (!existing) {
        // First, create the ServiceProvider
        const serviceProvider = await tx.serviceProvider.create({
          data: {
            id: professional.serviceProviderId,
            type: 'PROFESSIONAL',
            averageRating: 0,
            totalReviews: 0,
          },
        });

        // Then create the Professional
        return tx.professional.create({
          data: {
            id: professional.id,
            userId: professional.userId,
            serviceProviderId: serviceProvider.id,
            description: professional.description,
            experienceYears: professional.experienceYears,
            status: professional.status,
            zone: professional.zone,
            city: professional.city,
            address: professional.address,
            website: professional.website,
            profileImage: professional.profileImage,
            gallery: professional.gallery,
            trades: PrismaProfessionalMapper.toPersistenceTrades(tradeIds),
          },
          include: standardIncludes,
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
          website: professional.website,
          profileImage: professional.profileImage,
          gallery: professional.gallery,
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
        include: standardIncludes,
      });
    });

    return PrismaProfessionalMapper.toDomain(result);
  }

  /**
   * Update the status of a professional profile.
   */
  async updateStatus(
    id: string,
    status: ProfessionalStatus,
  ): Promise<ProfessionalEntity> {
    const updated = await this.prisma.professional.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      include: standardIncludes,
    });

    return PrismaProfessionalMapper.toDomain(updated);
  }

  /**
   * Update rating on the ServiceProvider associated with this professional
   */
  async updateRating(
    id: string,
    averageRating: number,
    totalReviews: number,
  ): Promise<void> {
    // First get the professional to find its serviceProviderId
    const professional = await this.prisma.professional.findUnique({
      where: { id },
      select: { serviceProviderId: true },
    });

    if (!professional) {
      throw new Error(`Professional not found: ${id}`);
    }

    await this.prisma.serviceProvider.update({
      where: { id: professional.serviceProviderId },
      data: {
        averageRating,
        totalReviews,
      },
    });
  }

  /**
   * Find a professional by their serviceProviderId
   */
  async findByServiceProviderId(serviceProviderId: string): Promise<ProfessionalEntity | null> {
    const professional = await this.prisma.professional.findUnique({
      where: { serviceProviderId },
      include: standardIncludes,
    });

    if (!professional) return null;

    return PrismaProfessionalMapper.toDomain(professional);
  }
}
