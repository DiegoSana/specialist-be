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
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { ProfessionalService } from '../application/services/professional.service';
import { CreateProfessionalDto } from '../application/dto/create-professional.dto';
import { UpdateProfessionalDto } from '../application/dto/update-professional.dto';
import { SearchProfessionalsDto } from '../application/dto/search-professionals.dto';
import { Public } from '../../shared/presentation/decorators/public.decorator';
import {
  ProfessionalResponseDto,
  ProfessionalSearchResultDto,
} from './dto/professional-response.dto';

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly professionalService: ProfessionalService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search professionals (public)' })
  @ApiResponse({ status: 200, description: 'List of professionals', type: [ProfessionalSearchResultDto] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tradeId', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'zone', required: false })
  async search(@Query() searchDto: SearchProfessionalsDto): Promise<ProfessionalSearchResultDto[]> {
    const entities = await this.professionalService.search(searchDto);
    return ProfessionalSearchResultDto.fromEntities(entities);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get professional by ID (public)' })
  @ApiResponse({ status: 200, description: 'Professional details', type: ProfessionalResponseDto })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  async findById(@Param('id') id: string): Promise<ProfessionalResponseDto> {
    const entity = await this.professionalService.findById(id);
    return ProfessionalResponseDto.fromEntity(entity);
  }

  // ==================== AUTHENTICATED ENDPOINTS ====================

  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my professional profile' })
  @ApiResponse({ status: 200, description: 'Professional profile', type: ProfessionalResponseDto })
  @ApiResponse({ status: 404, description: 'Professional profile not found' })
  async getMyProfile(@CurrentUser() user: UserEntity): Promise<ProfessionalResponseDto> {
    const entity = await this.professionalService.findByUserId(user.id);
    return ProfessionalResponseDto.fromEntity(entity);
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create my professional profile' })
  @ApiResponse({ status: 201, description: 'Profile created successfully', type: ProfessionalResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Profile already exists or invalid data',
  })
  async createMyProfile(
    @CurrentUser() user: UserEntity,
    @Body() createDto: CreateProfessionalDto,
  ): Promise<ProfessionalResponseDto> {
    const result = await this.professionalService.createProfile(user.id, createDto);
    return ProfessionalResponseDto.fromEntity(result.professional);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update my professional profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully', type: ProfessionalResponseDto })
  async updateMyProfile(
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateProfessionalDto,
  ): Promise<ProfessionalResponseDto> {
    const professional = await this.professionalService.findByUserId(user.id);
    const entity = await this.professionalService.updateProfile(user, professional.id, updateDto);
    return ProfessionalResponseDto.fromEntity(entity);
  }

  @Post('me/gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to my gallery' })
  @ApiResponse({ status: 201, description: 'Gallery item added successfully', type: ProfessionalResponseDto })
  async addGalleryItem(
    @CurrentUser() user: UserEntity,
    @Body() body: { url: string },
  ): Promise<ProfessionalResponseDto> {
    const entity = await this.professionalService.addGalleryItem(user, body.url);
    return ProfessionalResponseDto.fromEntity(entity);
  }

  @Delete('me/gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove item from my gallery' })
  @ApiResponse({
    status: 200,
    description: 'Gallery item removed successfully',
    type: ProfessionalResponseDto,
  })
  async removeGalleryItem(
    @CurrentUser() user: UserEntity,
    @Body() body: { url: string },
  ): Promise<ProfessionalResponseDto> {
    const entity = await this.professionalService.removeGalleryItem(user, body.url);
    return ProfessionalResponseDto.fromEntity(entity);
  }
}
