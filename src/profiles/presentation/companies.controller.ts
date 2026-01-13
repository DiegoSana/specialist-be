import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { Public } from '../../shared/presentation/decorators/public.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { CompanyService } from '../application/services/company.service';
import { CreateCompanyDto } from '../application/dto/create-company.dto';
import { UpdateCompanyDto } from '../application/dto/update-company.dto';
import { SearchCompaniesDto } from '../application/dto/search-companies.dto';
import {
  CompanyResponseDto,
  CompanySearchResultDto,
} from './dto/company-response.dto';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companyService: CompanyService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search companies (public)' })
  @ApiResponse({
    status: 200,
    description: 'List of companies',
    type: [CompanySearchResultDto],
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tradeId', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'verified', required: false })
  async search(
    @Query() searchDto: SearchCompaniesDto,
  ): Promise<CompanySearchResultDto[]> {
    const entities = await this.companyService.search(searchDto);
    return CompanySearchResultDto.fromEntities(entities);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get company by ID (public)' })
  @ApiResponse({
    status: 200,
    description: 'Company details',
    type: CompanySearchResultDto,
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findById(@Param('id') id: string): Promise<CompanySearchResultDto> {
    const entity = await this.companyService.findById(id);
    return CompanySearchResultDto.fromEntity(entity);
  }

  // ==================== AUTHENTICATED ENDPOINTS ====================

  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my company profile' })
  @ApiResponse({
    status: 200,
    description: 'Company profile',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company profile not found' })
  async getMyProfile(
    @CurrentUser() user: UserEntity,
  ): Promise<CompanyResponseDto> {
    const entity = await this.companyService.findByUserId(user.id);
    return CompanyResponseDto.fromEntity(entity);
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create my company profile' })
  @ApiResponse({
    status: 201,
    description: 'Profile created successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Profile already exists or invalid data',
  })
  async createMyProfile(
    @CurrentUser() user: UserEntity,
    @Body() createDto: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    const result = await this.companyService.createProfile(user.id, createDto);
    return CompanyResponseDto.fromEntity(result.company);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update my company profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async updateMyProfile(
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    // Get my company first
    const myCompany = await this.companyService.findByUserId(user.id);
    const entity = await this.companyService.updateProfile(
      user,
      myCompany.id,
      updateDto,
    );
    return CompanyResponseDto.fromEntity(entity);
  }

  @Post('me/gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add image to gallery' })
  @ApiResponse({
    status: 201,
    description: 'Image added successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Image already in gallery' })
  async addGalleryItem(
    @CurrentUser() user: UserEntity,
    @Body('url') url: string,
  ): Promise<CompanyResponseDto> {
    const entity = await this.companyService.addGalleryItem(user, url);
    return CompanyResponseDto.fromEntity(entity);
  }

  @Delete('me/gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove image from gallery' })
  @ApiResponse({
    status: 200,
    description: 'Image removed successfully',
    type: CompanyResponseDto,
  })
  async removeGalleryItem(
    @CurrentUser() user: UserEntity,
    @Body('url') url: string,
  ): Promise<CompanyResponseDto> {
    const entity = await this.companyService.removeGalleryItem(user, url);
    return CompanyResponseDto.fromEntity(entity);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify company (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Company verified successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async verifyCompany(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
  ): Promise<CompanyResponseDto> {
    const entity = await this.companyService.verifyCompany(user, id);
    return CompanyResponseDto.fromEntity(entity);
  }
}

