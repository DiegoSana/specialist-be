import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { RequestEntity } from '../../domain/entities/request.entity';

/**
 * Nested DTO for trade information in request response
 */
export class RequestTradeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  category: string | null;
}

/**
 * Nested DTO for user/professional info in request response
 */
export class RequestUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional()
  profilePictureUrl: string | null;
}

/**
 * Nested DTO for professional info in request response
 */
export class RequestProfessionalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  user: RequestUserDto | null;

  @ApiPropertyOptional()
  averageRating: number;

  @ApiPropertyOptional()
  totalReviews: number;
}

/**
 * Response DTO for request endpoints.
 * Provides a clean API contract independent of domain entity structure.
 */
export class RequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clientId: string;

  @ApiPropertyOptional()
  professionalId: string | null;

  @ApiPropertyOptional()
  tradeId: string | null;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  address: string | null;

  @ApiPropertyOptional()
  availability: string | null;

  @ApiProperty({ type: [String] })
  photos: string[];

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiPropertyOptional()
  clientRating: number | null;

  @ApiPropertyOptional()
  clientRatingComment: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Related data (populated when available)
  @ApiPropertyOptional({ type: RequestUserDto })
  client?: RequestUserDto;

  @ApiPropertyOptional({ type: RequestProfessionalDto })
  professional?: RequestProfessionalDto;

  @ApiPropertyOptional({ type: RequestTradeDto })
  trade?: RequestTradeDto;

  /**
   * Convert domain entity to response DTO.
   * The entity may have attached related data (client, professional, trade)
   * from the repository's Prisma mapper.
   * 
   * @param entity - Request domain entity (may include attached related data)
   */
  static fromEntity(entity: RequestEntity): RequestResponseDto {
    const dto = new RequestResponseDto();

    // Core fields
    dto.id = entity.id;
    dto.clientId = entity.clientId;
    dto.professionalId = entity.professionalId;
    dto.tradeId = entity.tradeId;
    dto.isPublic = entity.isPublic;
    dto.title = entity.title;
    dto.description = entity.description;
    dto.address = entity.address;
    dto.availability = entity.availability;
    dto.photos = entity.photos;
    dto.status = entity.status;
    dto.clientRating = entity.clientRating;
    dto.clientRatingComment = entity.clientRatingComment;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    // Extract attached related data from entity (set by Prisma mapper)
    const entityAny = entity as any;

    if (entityAny.client) {
      dto.client = {
        id: entityAny.client.id,
        firstName: entityAny.client.firstName,
        lastName: entityAny.client.lastName,
        profilePictureUrl: entityAny.client.profilePictureUrl ?? null,
      };
    }

    if (entityAny.professional) {
      dto.professional = {
        id: entityAny.professional.id,
        userId: entityAny.professional.userId,
        user: entityAny.professional.user
          ? {
              id: entityAny.professional.user.id,
              firstName: entityAny.professional.user.firstName,
              lastName: entityAny.professional.user.lastName,
              profilePictureUrl: entityAny.professional.user.profilePictureUrl ?? null,
            }
          : null,
        averageRating: entityAny.professional.averageRating ?? 0,
        totalReviews: entityAny.professional.totalReviews ?? 0,
      };
    }

    if (entityAny.trade) {
      dto.trade = {
        id: entityAny.trade.id,
        name: entityAny.trade.name,
        category: entityAny.trade.category ?? null,
      };
    }

    return dto;
  }

  /**
   * Convert multiple entities to DTOs.
   */
  static fromEntities(entities: RequestEntity[]): RequestResponseDto[] {
    return entities.map((entity) => RequestResponseDto.fromEntity(entity));
  }
}

