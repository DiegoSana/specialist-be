import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';
import { Public } from '../../shared/presentation/decorators/public.decorator';
import { ProfessionalService } from '../application/services/professional.service';
import { CompanyService } from '../application/services/company.service';
import { SearchProfessionalsDto } from '../application/dto/search-professionals.dto';
import { SearchCompaniesDto } from '../application/dto/search-companies.dto';
// Note: We use 'any' type for mappers because services return sanitized objects

/**
 * Unified provider result for the catalog
 */
class UnifiedProviderResultDto {
  @ApiProperty({ example: 'prof-123' })
  id: string;

  @ApiProperty({ example: 'sp-456' })
  serviceProviderId: string;

  @ApiProperty({ example: 'PROFESSIONAL', enum: ['PROFESSIONAL', 'COMPANY'] })
  type: 'PROFESSIONAL' | 'COMPANY';

  @ApiProperty({ example: 'Juan Pérez' })
  displayName: string;

  @ApiProperty({ example: 'Servicios de plomería profesional' })
  description: string | null;

  @ApiProperty({ example: 'Bariloche' })
  city: string;

  @ApiProperty({ example: 'Centro', required: false })
  zone: string | null;

  @ApiProperty({ example: 4.8 })
  averageRating: number;

  @ApiProperty({ example: 15 })
  totalReviews: number;

  @ApiProperty({ required: false })
  profileImage: string | null;

  @ApiProperty()
  trades: {
    id: string;
    name: string;
    isPrimary: boolean;
  }[];

  @ApiProperty({ example: true })
  hasVerifiedBadge: boolean;

  // Company-specific fields (optional)
  @ApiProperty({ required: false })
  companyName?: string;

  @ApiProperty({ required: false })
  employeeCount?: string;

  // Professional-specific fields (optional)
  @ApiProperty({ required: false })
  experienceYears?: number;

  @ApiProperty({ required: false })
  user?: {
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
  };
}

/**
 * DTO for unified provider search
 */
class SearchProvidersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tradeId?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsIn(['PROFESSIONAL', 'COMPANY', 'ALL'])
  providerType?: 'PROFESSIONAL' | 'COMPANY' | 'ALL';
}

@ApiTags('Providers')
@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly professionalService: ProfessionalService,
    private readonly companyService: CompanyService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Search service providers (unified catalog)',
    description:
      'Search both professionals and companies in a unified view. ' +
      'Use providerType filter to show only one type.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of service providers',
    type: [UnifiedProviderResultDto],
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or description' })
  @ApiQuery({ name: 'tradeId', required: false, description: 'Filter by trade ID' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city' })
  @ApiQuery({ name: 'zone', required: false, description: 'Filter by zone' })
  @ApiQuery({
    name: 'providerType',
    required: false,
    enum: ['PROFESSIONAL', 'COMPANY', 'ALL'],
    description: 'Filter by provider type (default: ALL)',
  })
  async searchProviders(
    @Query() query: SearchProvidersDto,
  ): Promise<UnifiedProviderResultDto[]> {
    const providerType = query.providerType || 'ALL';
    const results: UnifiedProviderResultDto[] = [];

    // Fetch professionals if requested
    if (providerType === 'ALL' || providerType === 'PROFESSIONAL') {
      const professionalsDto: SearchProfessionalsDto = {
        search: query.search,
        tradeId: query.tradeId,
      };
      let professionals = await this.professionalService.search(professionalsDto);
      
      // Filter by city/zone if provided (post-fetch filter)
      if (query.city) {
        professionals = professionals.filter((p: any) => 
          p.city?.toLowerCase() === query.city?.toLowerCase()
        );
      }
      if (query.zone) {
        professionals = professionals.filter((p: any) => 
          p.zone?.toLowerCase() === query.zone?.toLowerCase()
        );
      }
      
      results.push(...professionals.map((p) => this.mapProfessional(p)));
    }

    // Fetch companies if requested
    if (providerType === 'ALL' || providerType === 'COMPANY') {
      const companiesDto: SearchCompaniesDto = {
        search: query.search,
        tradeId: query.tradeId,
        city: query.city,
      };
      const companies = await this.companyService.search(companiesDto);
      results.push(...companies.map((c) => this.mapCompany(c)));
    }

    // Sort by rating (descending), then by reviews count (descending)
    results.sort((a, b) => {
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }
      return b.totalReviews - a.totalReviews;
    });

    return results;
  }

  private mapProfessional(p: any): UnifiedProviderResultDto {
    const user = p.user;
    // Note: p might be a sanitized object (not a full entity with methods)
    const hasVerifiedBadge = p.status === 'VERIFIED';
    return {
      id: p.id,
      serviceProviderId: p.serviceProviderId,
      type: 'PROFESSIONAL',
      displayName: user ? `${user.firstName} ${user.lastName}` : 'Profesional',
      description: p.description,
      city: p.city,
      zone: p.zone,
      averageRating: p.averageRating ?? 0,
      totalReviews: p.totalReviews ?? 0,
      profileImage: p.profileImage,
      trades: (p.trades || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        isPrimary: t.isPrimary,
      })),
      hasVerifiedBadge,
      experienceYears: p.experienceYears ?? undefined,
      user: user
        ? {
            firstName: user.firstName,
            lastName: user.lastName,
            profilePictureUrl: user.profilePictureUrl,
          }
        : undefined,
    };
  }

  private mapCompany(c: any): UnifiedProviderResultDto {
    // Note: c might be a sanitized object (not a full entity with methods)
    const hasVerifiedBadge = c.status === 'VERIFIED';
    return {
      id: c.id,
      serviceProviderId: c.serviceProviderId,
      type: 'COMPANY',
      displayName: c.companyName,
      description: c.description,
      city: c.city,
      zone: c.zone,
      averageRating: c.averageRating ?? 0,
      totalReviews: c.totalReviews ?? 0,
      profileImage: c.profileImage,
      trades: (c.trades || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        isPrimary: t.isPrimary,
      })),
      hasVerifiedBadge,
      companyName: c.companyName,
      employeeCount: c.employeeCount ?? undefined,
    };
  }
}

