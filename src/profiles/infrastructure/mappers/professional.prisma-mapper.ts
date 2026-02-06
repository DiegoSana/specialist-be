import { ProfessionalStatus, ProviderType as PrismaProviderType } from '@prisma/client';
import {
  ProfessionalEntity,
  TradeInfo,
} from '../../domain/entities/professional.entity';
import { ServiceProviderEntity, ProviderType } from '../../domain/entities/service-provider.entity';
import { PrismaServiceProviderMapper } from './service-provider.prisma-mapper';

export class PrismaProfessionalMapper {
  static toDomain(professional: {
    id: string;
    userId: string;
    serviceProviderId: string;
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
    website: string | null;
    profileImage: string | null;
    gallery: string[];
    createdAt: Date;
    updatedAt: Date;
    user?: unknown;
    serviceProvider?: {
      id: string;
      type: PrismaProviderType;
      averageRating: number;
      totalReviews: number;
      createdAt: Date;
      updatedAt: Date;
    };
  }): ProfessionalEntity {
    const trades: TradeInfo[] = (professional.trades || []).map((pt) => ({
      id: pt.trade.id,
      name: pt.trade.name,
      category: pt.trade.category,
      description: pt.trade.description,
      isPrimary: pt.isPrimary,
    }));

    // Map ServiceProvider if included
    const serviceProvider = professional.serviceProvider
      ? PrismaServiceProviderMapper.toDomain(professional.serviceProvider)
      : undefined;

    const entity = new ProfessionalEntity(
      professional.id,
      professional.userId,
      professional.serviceProviderId,
      trades,
      professional.description,
      professional.experienceYears,
      professional.status as ProfessionalStatus,
      professional.zone,
      professional.city,
      professional.address,
      professional.website,
      professional.profileImage,
      professional.gallery,
      professional.createdAt,
      professional.updatedAt,
      serviceProvider,
    );

    // Mantener el comportamiento actual: adjuntar datos de user si vienen incluidos.
    if (professional.user) {
      (entity as any).user = professional.user;
    }

    return entity;
  }

  static toPersistenceCreate(input: {
    userId: string;
    serviceProviderId: string;
    tradeIds: string[];
    description: string | null;
    experienceYears: number | null;
    status: ProfessionalStatus;
    zone: string | null;
    city: string;
    address: string | null;
    website: string | null;
    profileImage: string | null;
    gallery: string[];
  }): Record<string, unknown> {
    return {
      userId: input.userId,
      serviceProviderId: input.serviceProviderId,
      description: input.description,
      experienceYears: input.experienceYears,
      status: input.status,
      zone: input.zone,
      city: input.city,
      address: input.address,
      website: input.website,
      profileImage: input.profileImage,
      gallery: input.gallery,
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
      ...(partial.website !== undefined && { website: partial.website }),
      ...(partial.profileImage !== undefined && {
        profileImage: partial.profileImage,
      }),
      ...(partial.gallery !== undefined && { gallery: partial.gallery }),
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
