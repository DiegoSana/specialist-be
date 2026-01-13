import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfessionalStatus } from '@prisma/client';
import { ProfessionalEntity, TradeInfo } from '../../domain/entities/professional.entity';

/**
 * Nested DTO for trade information in professional response
 */
export class ProfessionalTradeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  category: string | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty()
  isPrimary: boolean;
}

/**
 * Nested DTO for user info in professional response
 */
export class ProfessionalUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  profilePictureUrl: string | null;
}

/**
 * Response DTO for professional profile endpoints.
 * Provides a clean API contract independent of domain entity structure.
 */
export class ProfessionalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ type: [ProfessionalTradeDto] })
  trades: ProfessionalTradeDto[];

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  experienceYears: number | null;

  @ApiProperty({ enum: ProfessionalStatus })
  status: ProfessionalStatus;

  @ApiPropertyOptional()
  zone: string | null;

  @ApiProperty()
  city: string;

  @ApiPropertyOptional()
  address: string | null;

  @ApiPropertyOptional()
  whatsapp: string | null;

  @ApiPropertyOptional()
  website: string | null;

  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  totalReviews: number;

  @ApiPropertyOptional()
  profileImage: string | null;

  @ApiProperty({ type: [String] })
  gallery: string[];

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Related data (populated when available)
  @ApiPropertyOptional({ type: ProfessionalUserDto })
  user?: ProfessionalUserDto;

  // Computed property
  @ApiPropertyOptional({ type: ProfessionalTradeDto })
  primaryTrade?: ProfessionalTradeDto | null;

  /**
   * Convert domain entity to response DTO.
   * The entity may have attached user data from the Prisma mapper.
   */
  static fromEntity(entity: ProfessionalEntity): ProfessionalResponseDto {
    const dto = new ProfessionalResponseDto();

    // Core fields
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.trades = entity.trades.map((trade) => ({
      id: trade.id,
      name: trade.name,
      category: trade.category,
      description: trade.description,
      isPrimary: trade.isPrimary,
    }));
    dto.description = entity.description;
    dto.experienceYears = entity.experienceYears;
    dto.status = entity.status;
    dto.zone = entity.zone;
    dto.city = entity.city;
    dto.address = entity.address;
    dto.whatsapp = entity.whatsapp;
    dto.website = entity.website;
    dto.averageRating = entity.averageRating;
    dto.totalReviews = entity.totalReviews;
    dto.profileImage = entity.profileImage;
    dto.gallery = entity.gallery;
    dto.active = entity.active;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    // Computed property
    dto.primaryTrade = entity.primaryTrade
      ? {
          id: entity.primaryTrade.id,
          name: entity.primaryTrade.name,
          category: entity.primaryTrade.category,
          description: entity.primaryTrade.description,
          isPrimary: entity.primaryTrade.isPrimary,
        }
      : null;

    // Extract attached user data from entity (set by Prisma mapper)
    const entityAny = entity as any;
    if (entityAny.user) {
      dto.user = {
        id: entityAny.user.id,
        firstName: entityAny.user.firstName,
        lastName: entityAny.user.lastName,
        email: entityAny.user.email,
        profilePictureUrl: entityAny.user.profilePictureUrl ?? null,
      };
    }

    return dto;
  }

  /**
   * Convert multiple entities to DTOs.
   */
  static fromEntities(entities: ProfessionalEntity[]): ProfessionalResponseDto[] {
    return entities.map((entity) => ProfessionalResponseDto.fromEntity(entity));
  }
}

/**
 * Simplified DTO for public search results.
 * Excludes sensitive contact fields (whatsapp, address, website).
 * Includes gallery since it's public and shown in search results.
 */
export class ProfessionalSearchResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ type: [ProfessionalTradeDto] })
  trades: ProfessionalTradeDto[];

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  experienceYears: number | null;

  @ApiProperty({ enum: ProfessionalStatus })
  status: ProfessionalStatus;

  @ApiPropertyOptional()
  zone: string | null;

  @ApiProperty()
  city: string;

  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  totalReviews: number;

  @ApiPropertyOptional()
  profileImage: string | null;

  @ApiProperty({ type: [String] })
  gallery: string[];

  @ApiProperty()
  active: boolean;

  @ApiPropertyOptional({ type: ProfessionalUserDto })
  user?: ProfessionalUserDto;

  @ApiPropertyOptional({ type: ProfessionalTradeDto })
  primaryTrade?: ProfessionalTradeDto | null;

  /**
   * Convert domain entity to search result DTO.
   * Excludes sensitive contact information.
   */
  static fromEntity(entity: ProfessionalEntity): ProfessionalSearchResultDto {
    const dto = new ProfessionalSearchResultDto();

    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.trades = entity.trades.map((trade) => ({
      id: trade.id,
      name: trade.name,
      category: trade.category,
      description: trade.description,
      isPrimary: trade.isPrimary,
    }));
    dto.description = entity.description;
    dto.experienceYears = entity.experienceYears;
    dto.status = entity.status;
    dto.zone = entity.zone;
    dto.city = entity.city;
    dto.averageRating = entity.averageRating;
    dto.totalReviews = entity.totalReviews;
    dto.profileImage = entity.profileImage;
    dto.gallery = entity.gallery;
    dto.active = entity.active;

    // Computed property
    dto.primaryTrade = entity.primaryTrade
      ? {
          id: entity.primaryTrade.id,
          name: entity.primaryTrade.name,
          category: entity.primaryTrade.category,
          description: entity.primaryTrade.description,
          isPrimary: entity.primaryTrade.isPrimary,
        }
      : null;

    // Extract attached user data (limited info for public)
    const entityAny = entity as any;
    if (entityAny.user) {
      dto.user = {
        id: entityAny.user.id,
        firstName: entityAny.user.firstName,
        lastName: entityAny.user.lastName,
        profilePictureUrl: entityAny.user.profilePictureUrl ?? null,
      };
    }

    return dto;
  }

  /**
   * Convert multiple entities to DTOs.
   */
  static fromEntities(entities: ProfessionalEntity[]): ProfessionalSearchResultDto[] {
    return entities.map((entity) => ProfessionalSearchResultDto.fromEntity(entity));
  }
}

