import { ProfessionalStatus } from '@prisma/client';
import {
  ProfessionalEntity,
  TradeInfo,
} from '../../domain/entities/professional.entity';

export class PrismaProfessionalMapper {
  static toDomain(professional: {
    id: string;
    userId: string;
    trades?: Array<{
      isPrimary: boolean;
      trade: {
        id: string;
        name: string;
        category: string | null;
        description: string | null;
      };
    }>;
    description: string | null;
    experienceYears: number | null;
    status: ProfessionalStatus;
    zone: string | null;
    city: string;
    address: string | null;
    whatsapp: string | null;
    website: string | null;
    averageRating: number;
    totalReviews: number;
    profileImage: string | null;
    gallery: string[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    user?: unknown;
  }): ProfessionalEntity {
    const trades: TradeInfo[] = (professional.trades || []).map((pt) => ({
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

    // Mantener el comportamiento actual: adjuntar datos de user si vienen incluidos.
    if (professional.user) {
      (entity as any).user = professional.user;
    }

    return entity;
  }

  static toPersistenceCreate(input: {
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
  }): Record<string, unknown> {
    return {
      userId: input.userId,
      description: input.description,
      experienceYears: input.experienceYears,
      status: input.status,
      zone: input.zone,
      city: input.city,
      address: input.address,
      whatsapp: input.whatsapp,
      website: input.website,
      profileImage: input.profileImage,
      gallery: input.gallery,
      active: input.active,
      trades: {
        create: input.tradeIds.map((tradeId, index) => ({
          tradeId,
          isPrimary: index === 0,
        })),
      },
    };
  }

  static toPersistenceUpdate(
    partial: Partial<ProfessionalEntity>,
  ): Record<string, unknown> {
    return {
      ...(partial.description !== undefined && {
        description: partial.description,
      }),
      ...(partial.experienceYears !== undefined && {
        experienceYears: partial.experienceYears,
      }),
      ...(partial.status !== undefined && { status: partial.status }),
      ...(partial.zone !== undefined && { zone: partial.zone }),
      ...(partial.city !== undefined && { city: partial.city }),
      ...(partial.address !== undefined && { address: partial.address }),
      ...(partial.whatsapp !== undefined && { whatsapp: partial.whatsapp }),
      ...(partial.website !== undefined && { website: partial.website }),
      ...(partial.profileImage !== undefined && {
        profileImage: partial.profileImage,
      }),
      ...(partial.gallery !== undefined && { gallery: partial.gallery }),
      ...(partial.active !== undefined && { active: partial.active }),
    };
  }

  static toPersistenceTrades(tradeIds: string[]): {
    create: Array<{ tradeId: string; isPrimary: boolean }>;
  } {
    return {
      create: tradeIds.map((tradeId, index) => ({
        tradeId,
        isPrimary: index === 0,
      })),
    };
  }
}
