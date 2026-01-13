import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyEntity, CompanyStatus } from '../../domain/entities/company.entity';

class CompanyTradeDto {
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

class CompanyUserDto {
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
 * Full company response DTO - includes all fields
 * Used for: owner viewing their profile, admin viewing any profile
 */
export class CompanyResponseDto {
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

  @ApiProperty({ type: [CompanyTradeDto] })
  trades: CompanyTradeDto[];

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  foundedYear: number | null;

  @ApiPropertyOptional({ description: 'Employee count range (e.g., "1-5", "6-20")' })
  employeeCount: string | null;

  @ApiPropertyOptional()
  website: string | null;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  email: string | null;

  @ApiPropertyOptional()
  address: string | null;

  @ApiProperty()
  city: string;

  @ApiPropertyOptional()
  zone: string | null;

  @ApiProperty({ enum: CompanyStatus })
  status: CompanyStatus;

  @ApiPropertyOptional()
  profileImage: string | null;

  @ApiProperty({ type: [String] })
  gallery: string[];

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  totalReviews: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: CompanyUserDto })
  user?: CompanyUserDto;

  @ApiPropertyOptional({ type: CompanyTradeDto })
  primaryTrade?: CompanyTradeDto | null;

  static fromEntity(entity: CompanyEntity): CompanyResponseDto {
    const dto = new CompanyResponseDto();

    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.serviceProviderId = entity.serviceProviderId;
    dto.companyName = entity.companyName;
    dto.legalName = entity.legalName;
    dto.taxId = entity.taxId;
    dto.trades = entity.trades.map((trade) => ({
      id: trade.id,
      name: trade.name,
      category: trade.category,
      description: trade.description,
      isPrimary: trade.isPrimary,
    }));
    dto.description = entity.description;
    dto.foundedYear = entity.foundedYear;
    dto.employeeCount = entity.employeeCount;
    dto.website = entity.website;
    dto.phone = entity.phone;
    dto.email = entity.email;
    dto.address = entity.address;
    dto.city = entity.city;
    dto.zone = entity.zone;
    dto.status = entity.status;
    dto.profileImage = entity.profileImage;
    dto.gallery = entity.gallery;
    dto.active = entity.active;
    dto.averageRating = entity.averageRating;
    dto.totalReviews = entity.totalReviews;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    // Computed
    dto.primaryTrade = entity.primaryTrade
      ? {
          id: entity.primaryTrade.id,
          name: entity.primaryTrade.name,
          category: entity.primaryTrade.category,
          description: entity.primaryTrade.description,
          isPrimary: entity.primaryTrade.isPrimary,
        }
      : null;

    // Attached user
    if (entity.user) {
      dto.user = {
        id: entity.user.id,
        firstName: entity.user.firstName,
        lastName: entity.user.lastName,
        profilePictureUrl: entity.user.profilePictureUrl ?? null,
      };
    }

    return dto;
  }

  static fromEntities(entities: CompanyEntity[]): CompanyResponseDto[] {
    return entities.map((entity) => CompanyResponseDto.fromEntity(entity));
  }
}

/**
 * Public company search result DTO - excludes sensitive contact info
 * Used for: public search results, listing companies
 */
export class CompanySearchResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  serviceProviderId: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty({ type: [CompanyTradeDto] })
  trades: CompanyTradeDto[];

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  foundedYear: number | null;

  @ApiPropertyOptional({ description: 'Employee count range (e.g., "1-5", "6-20")' })
  employeeCount: string | null;

  @ApiProperty()
  city: string;

  @ApiPropertyOptional()
  zone: string | null;

  @ApiProperty({ enum: CompanyStatus })
  status: CompanyStatus;

  @ApiPropertyOptional()
  profileImage: string | null;

  @ApiProperty({ type: [String] })
  gallery: string[];

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  totalReviews: number;

  @ApiPropertyOptional({ type: CompanyUserDto })
  user?: CompanyUserDto;

  @ApiPropertyOptional({ type: CompanyTradeDto })
  primaryTrade?: CompanyTradeDto | null;

  static fromEntity(entity: CompanyEntity): CompanySearchResultDto {
    const dto = new CompanySearchResultDto();

    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.serviceProviderId = entity.serviceProviderId;
    dto.companyName = entity.companyName;
    dto.trades = entity.trades.map((trade) => ({
      id: trade.id,
      name: trade.name,
      category: trade.category,
      description: trade.description,
      isPrimary: trade.isPrimary,
    }));
    dto.description = entity.description;
    dto.foundedYear = entity.foundedYear;
    dto.employeeCount = entity.employeeCount;
    dto.city = entity.city;
    dto.zone = entity.zone;
    dto.status = entity.status;
    dto.profileImage = entity.profileImage;
    dto.gallery = entity.gallery;
    dto.active = entity.active;
    dto.averageRating = entity.averageRating;
    dto.totalReviews = entity.totalReviews;

    // Computed
    dto.primaryTrade = entity.primaryTrade
      ? {
          id: entity.primaryTrade.id,
          name: entity.primaryTrade.name,
          category: entity.primaryTrade.category,
          description: entity.primaryTrade.description,
          isPrimary: entity.primaryTrade.isPrimary,
        }
      : null;

    // Attached user (limited info)
    if (entity.user) {
      dto.user = {
        id: entity.user.id,
        firstName: entity.user.firstName,
        lastName: entity.user.lastName,
        profilePictureUrl: entity.user.profilePictureUrl ?? null,
      };
    }

    return dto;
  }

  static fromEntities(entities: CompanyEntity[]): CompanySearchResultDto[] {
    return entities.map((entity) => CompanySearchResultDto.fromEntity(entity));
  }
}
