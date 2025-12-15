import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProfessionalRepository } from '../../domain/repositories/professional.repository';
import { ProfessionalEntity } from '../../domain/entities/professional.entity';
import { ProfessionalStatus } from '@prisma/client';

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

    return this.toEntity(professional);
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

    return this.toEntity(professional);
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

    return professionals.map((p) => this.toEntity(p));
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

    return professionals.map((p) => this.toEntity(p));
  }

  async create(
    professionalData: {
      userId: string;
      tradeIds: string[];
      description: string | null;
      experienceYears: number | null;
      status: ProfessionalStatus;
      zone: string | null;
      city: string;
      address: string | null;
      whatsapp: string | null;
      website: string | null;
      profileImage: string | null;
      gallery: string[];
      active: boolean;
    },
  ): Promise<ProfessionalEntity> {
    const professional = await this.prisma.professional.create({
      data: {
        userId: professionalData.userId,
        description: professionalData.description,
        experienceYears: professionalData.experienceYears,
        status: professionalData.status,
        zone: professionalData.zone,
        city: professionalData.city,
        address: professionalData.address,
        whatsapp: professionalData.whatsapp,
        website: professionalData.website,
        profileImage: professionalData.profileImage,
        gallery: professionalData.gallery,
        active: professionalData.active,
        trades: {
          create: professionalData.tradeIds.map((tradeId, index) => ({
            tradeId,
            isPrimary: index === 0, // First trade is primary
          })),
        },
      },
      include: {
        trades: {
          include: {
            trade: true,
          },
        },
      },
    });

    return this.toEntity(professional);
  }

  async update(id: string, data: Partial<ProfessionalEntity> & { tradeIds?: string[] }): Promise<ProfessionalEntity> {
    const updateData: any = {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.experienceYears !== undefined && { experienceYears: data.experienceYears }),
      ...(data.status && { status: data.status }),
      ...(data.zone !== undefined && { zone: data.zone }),
      ...(data.city && { city: data.city }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.profileImage !== undefined && { profileImage: data.profileImage }),
      ...(data.gallery !== undefined && { gallery: data.gallery }),
      ...(data.active !== undefined && { active: data.active }),
    };

    // Handle trade updates
    if (data.tradeIds) {
      // Delete existing trades and create new ones
      await this.prisma.professionalTrade.deleteMany({
        where: { professionalId: id },
      });
      updateData.trades = {
        create: data.tradeIds.map((tradeId, index) => ({
          tradeId,
          isPrimary: index === 0,
        })),
      };
    }

    const professional = await this.prisma.professional.update({
      where: { id },
      data: updateData,
      include: {
        trades: {
          include: {
            trade: true,
          },
        },
      },
    });

    return this.toEntity(professional);
  }

  async updateRating(id: string, averageRating: number, totalReviews: number): Promise<void> {
    await this.prisma.professional.update({
      where: { id },
      data: {
        averageRating,
        totalReviews,
      },
    });
  }

  private toEntity(professional: any): ProfessionalEntity {
    const trades = (professional.trades || []).map((pt: any) => ({
      id: pt.trade.id,
      name: pt.trade.name,
      category: pt.trade.category,
      description: pt.trade.description,
      isPrimary: pt.isPrimary,
    }));

    const entity = new ProfessionalEntity(
      professional.id,
      professional.userId,
      trades,
      professional.description,
      professional.experienceYears,
      professional.status as ProfessionalStatus,
      professional.zone,
      professional.city,
      professional.address,
      professional.whatsapp,
      professional.website,
      professional.averageRating,
      professional.totalReviews,
      professional.profileImage,
      professional.gallery,
      professional.active,
      professional.createdAt,
      professional.updatedAt,
    );

    // Attach user data if available (for API responses)
    if (professional.user) {
      (entity as any).user = professional.user;
    }

    return entity;
  }
}

