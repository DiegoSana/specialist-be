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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { ProfessionalService } from '../application/services/professional.service';
import { CreateProfessionalDto } from '../application/dto/create-professional.dto';
import { UpdateProfessionalDto } from '../application/dto/update-professional.dto';
import { SearchProfessionalsDto } from '../application/dto/search-professionals.dto';
import { Public } from '../../shared/presentation/decorators/public.decorator';

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly professionalService: ProfessionalService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search professionals (public)' })
  @ApiResponse({ status: 200, description: 'List of professionals' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tradeId', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'zone', required: false })
  async search(@Query() searchDto: SearchProfessionalsDto) {
    return this.professionalService.search(searchDto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get professional by ID (public)' })
  @ApiResponse({ status: 200, description: 'Professional details' })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  async findById(@Param('id') id: string) {
    return this.professionalService.findById(id);
  }

  // ==================== AUTHENTICATED ENDPOINTS ====================

  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my professional profile' })
  @ApiResponse({ status: 200, description: 'Professional profile' })
  @ApiResponse({ status: 404, description: 'Professional profile not found' })
  async getMyProfile(@CurrentUser() user: UserEntity) {
    return this.professionalService.findByUserId(user.id);
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create my professional profile' })
  @ApiResponse({ status: 201, description: 'Profile created successfully' })
  @ApiResponse({ status: 400, description: 'Profile already exists or invalid data' })
  async createMyProfile(
    @CurrentUser() user: UserEntity,
    @Body() createDto: CreateProfessionalDto,
  ) {
    return this.professionalService.createProfile(user.id, createDto);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update my professional profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateMyProfile(
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateProfessionalDto,
  ) {
    const professional = await this.professionalService.findByUserId(user.id);
    return this.professionalService.updateProfile(user.id, professional.id, updateDto);
  }

  @Post('me/gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to my gallery' })
  @ApiResponse({ status: 201, description: 'Gallery item added successfully' })
  async addGalleryItem(
    @CurrentUser() user: UserEntity,
    @Body() body: { url: string },
  ) {
    return this.professionalService.addGalleryItem(user.id, body.url);
  }

  @Delete('me/gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove item from my gallery' })
  @ApiResponse({ status: 200, description: 'Gallery item removed successfully' })
  async removeGalleryItem(
    @CurrentUser() user: UserEntity,
    @Body() body: { url: string },
  ) {
    return this.professionalService.removeGalleryItem(user.id, body.url);
  }
}

