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
import { ReviewDirection } from '@prisma/client';
import { ReviewStatus } from '../domain/value-objects/review-status';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../shared/presentation/guards/admin.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { ReviewService } from '../application/services/review.service';
import { CreateReviewDto } from '../application/dto/create-review.dto';
import { UpdateReviewDto } from '../application/dto/update-review.dto';
import { FeatureReviewDto } from '../application/dto/feature-review.dto';
import { Public } from '../../shared/presentation/decorators/public.decorator';
import { ReviewResponseDto, PublicReviewDto } from './dto/review-response.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a review' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
    type: ReviewResponseDto,
  })
  async create(
    @CurrentUser() user: UserEntity,
    @Body() createDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const entity = await this.reviewService.create(user.id, createDto);
    return ReviewResponseDto.fromEntity(entity);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiResponse({
    status: 200,
    description: 'Review details',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<ReviewResponseDto> {
    const entity = await this.reviewService.findByIdForUser(id, user.id);
    return ReviewResponseDto.fromEntity(entity);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review by request ID' })
  @ApiQuery({ name: 'requestId', required: true })
  @ApiQuery({
    name: 'direction',
    required: false,
    enum: ReviewDirection,
    description: 'Defaults to CLIENT_TO_PROVIDER for backward compatibility',
  })
  @ApiResponse({
    status: 200,
    description: 'Review details',
    type: ReviewResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'No review found',
    schema: { type: 'null' },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findByRequestId(
    @Query('requestId') requestId: string,
    @CurrentUser() user: UserEntity,
    @Query('direction') direction?: ReviewDirection,
  ): Promise<ReviewResponseDto | null> {
    const entity = await this.reviewService.findByRequestIdForUser(
      requestId,
      user.id,
      direction,
    );
    if (!entity) {
      return null;
    }
    return ReviewResponseDto.fromEntity(entity);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a review' })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully',
    type: ReviewResponseDto,
  })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const entity = await this.reviewService.update(id, user.id, updateDto);
    return ReviewResponseDto.fromEntity(entity);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a review' })
  @ApiResponse({ status: 204, description: 'Review deleted successfully' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<void> {
    await this.reviewService.delete(id, user.id);
  }

  // ========== Admin Moderation Endpoints ==========

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get reviews for moderation (admin only). Despite the path (kept for backward compat), ' +
      'accepts an optional ?status= to list APPROVED/REJECTED reviews too — needed to reach an ' +
      'already-approved review and toggle isFeatured on it, since it no longer appears here once ' +
      'approved without this filter.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ReviewStatus,
    description: 'Defaults to PENDING for backward compatibility',
  })
  @ApiResponse({
    status: 200,
    description: 'List of reviews with the given status',
    type: [ReviewResponseDto],
  })
  async findPending(
    @Query('status') status?: ReviewStatus,
  ): Promise<ReviewResponseDto[]> {
    const entities = await this.reviewService.findByStatus(
      status ?? ReviewStatus.PENDING,
    );
    return ReviewResponseDto.fromEntities(entities);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a review (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Review approved successfully',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Review is not pending' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<ReviewResponseDto> {
    const entity = await this.reviewService.approve(id, user.id);
    return ReviewResponseDto.fromEntity(entity);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a review (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Review rejected successfully',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Review is not pending' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<ReviewResponseDto> {
    const entity = await this.reviewService.reject(id, user.id);
    return ReviewResponseDto.fromEntity(entity);
  }

  @Post(':id/feature')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Toggle whether an approved review is curated as a featured comment (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured flag updated successfully',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Review is not approved' })
  async setFeatured(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: FeatureReviewDto,
  ): Promise<ReviewResponseDto> {
    const entity = await this.reviewService.setFeatured(
      id,
      user.id,
      dto.isFeatured,
    );
    return ReviewResponseDto.fromEntity(entity);
  }
}

// Sub-resource controller for professional reviews (public access)
@ApiTags('Reviews')
@Controller('professionals')
export class ProfessionalReviewsController {
  constructor(private readonly reviewService: ReviewService) {}

  @Public()
  @Get(':professionalId/reviews')
  @ApiOperation({ summary: 'Get reviews for a professional (public)' })
  @ApiResponse({
    status: 200,
    description: 'List of reviews',
    type: [PublicReviewDto],
  })
  async findByProfessionalId(
    @Param('professionalId') professionalId: string,
  ): Promise<PublicReviewDto[]> {
    const entities =
      await this.reviewService.findByProfessionalId(professionalId);
    return PublicReviewDto.fromEntities(entities);
  }
}

// Sub-resource controller for any ServiceProvider's reviews (public access). Unlike
// ProfessionalReviewsController above (which takes a Professional's own id and 404s for a
// Company via ProfessionalService.getByIdOrFail), this takes a ServiceProvider id directly and
// works for both Professional and Company providers — see ADR-004 (ServiceProvider abstraction).
// Kept as a separate route (not a rewire of /professionals/:id/reviews) to avoid changing what
// that existing path's :id means for any caller still relying on it.
@ApiTags('Reviews')
@Controller('providers')
export class ServiceProviderReviewsController {
  constructor(private readonly reviewService: ReviewService) {}

  @Public()
  @Get(':serviceProviderId/reviews')
  @ApiOperation({
    summary:
      'Get approved reviews for a service provider, Professional or Company (public)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of reviews',
    type: [PublicReviewDto],
  })
  async findByServiceProviderId(
    @Param('serviceProviderId') serviceProviderId: string,
  ): Promise<PublicReviewDto[]> {
    const entities =
      await this.reviewService.findByServiceProviderId(serviceProviderId);
    return PublicReviewDto.fromEntities(entities);
  }
}
