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

  @ApiPropertyOptional()
  whatsapp: string | null;
}

/**
 * Nested DTO for company info in request response
 */
export class RequestCompanyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  serviceProviderId: string;

  @ApiProperty()
  companyName: string;

  @ApiPropertyOptional()
  legalName: string | null;

  @ApiPropertyOptional()
  taxId: string | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  email: string | null;

  @ApiPropertyOptional()
  website: string | null;

  @ApiPropertyOptional()
  city: string | null;

  @ApiPropertyOptional()
  zone: string | null;

  @ApiPropertyOptional()
  averageRating: number;

  @ApiPropertyOptional()
  totalReviews: number;

  @ApiPropertyOptional()
  profileImage: string | null;

  @ApiPropertyOptional({ type: RequestUserDto })
  user: RequestUserDto | null;

  @ApiProperty({ type: [Object] })
  trades: Array<{
    id: string;
    name: string;
    category: string | null;
    isPrimary: boolean;
  }>;
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
  professionalId: string | null; // Deprecated, use providerId

  @ApiPropertyOptional()
  providerId: string | null; // ServiceProvider ID (Professional or Company)

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

  @ApiPropertyOptional({ type: RequestCompanyDto })
  company?: RequestCompanyDto;

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
    dto.professionalId = entity.professionalId; // Backward compat
    dto.providerId = entity.providerId;
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
        whatsapp: entityAny.professional.whatsapp ?? null,
      };
    }

    if (entityAny.company) {
      dto.company = {
        id: entityAny.company.id,
        userId: entityAny.company.userId,
        serviceProviderId: entityAny.company.serviceProviderId,
        companyName: entityAny.company.companyName,
        legalName: entityAny.company.legalName ?? null,
        taxId: entityAny.company.taxId ?? null,
        description: entityAny.company.description ?? null,
        phone: entityAny.company.phone ?? null,
        email: entityAny.company.email ?? null,
        website: entityAny.company.website ?? null,
        city: entityAny.company.city ?? null,
        zone: entityAny.company.zone ?? null,
        averageRating: entityAny.company.averageRating ?? 0,
        totalReviews: entityAny.company.totalReviews ?? 0,
        profileImage: entityAny.company.profileImage ?? null,
        user: entityAny.company.user
          ? {
              id: entityAny.company.user.id,
              firstName: entityAny.company.user.firstName,
              lastName: entityAny.company.user.lastName,
              profilePictureUrl: entityAny.company.user.profilePictureUrl ?? null,
            }
          : null,
        trades: (entityAny.company.trades || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          isPrimary: t.isPrimary,
        })),
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

