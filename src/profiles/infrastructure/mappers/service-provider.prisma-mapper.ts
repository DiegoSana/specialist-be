import { ProviderType as PrismaProviderType } from '@prisma/client';
import {
  ServiceProviderEntity,
  ProviderType,
} from '../../domain/entities/service-provider.entity';

export class PrismaServiceProviderMapper {
  static toDomain(sp: {
    id: string;
    type: PrismaProviderType;
    averageRating: number;
    totalReviews: number;
    createdAt: Date;
    updatedAt: Date;
  }): ServiceProviderEntity {
    return new ServiceProviderEntity(
      sp.id,
      sp.type as unknown as ProviderType,
      sp.averageRating,
      sp.totalReviews,
      sp.createdAt,
      sp.updatedAt,
    );
  }

  static toPersistenceCreate(type: ProviderType): {
    type: PrismaProviderType;
    averageRating: number;
    totalReviews: number;
  } {
    return {
      type: type as unknown as PrismaProviderType,
      averageRating: 0,
      totalReviews: 0,
    };
  }

  static toPersistenceUpdate(entity: ServiceProviderEntity): {
    averageRating: number;
    totalReviews: number;
  } {
    return {
      averageRating: entity.averageRating,
      totalReviews: entity.totalReviews,
    };
  }
}

