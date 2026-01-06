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
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../shared/presentation/guards/admin.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { ReviewService } from '../application/services/review.service';
import { CreateReviewDto } from '../application/dto/create-review.dto';
import { UpdateReviewDto } from '../application/dto/update-review.dto';
import { Public } from '../../shared/presentation/decorators/public.decorator';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a review' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  async create(
    @CurrentUser() user: UserEntity,
    @Body() createDto: CreateReviewDto,
  ) {
    return this.reviewService.create(user.id, createDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiResponse({ status: 200, description: 'Review details' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findById(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.reviewService.findByIdForUser(id, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review by request ID' })
  @ApiQuery({ name: 'requestId', required: true })
  @ApiResponse({ status: 200, description: 'Review details' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findByRequestId(
    @Query('requestId') requestId: string,
    @CurrentUser() user: UserEntity,
  ) {
    const review = await this.reviewService.findByRequestIdForUser(
      requestId,
      user.id,
    );
    if (!review) {
      throw new NotFoundException('Review not found for this request');
    }
    return review;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a review' })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateReviewDto,
  ) {
    return this.reviewService.update(id, user.id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a review' })
  @ApiResponse({ status: 204, description: 'Review deleted successfully' })
  async delete(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    await this.reviewService.delete(id, user.id);
  }

  // ========== Admin Moderation Endpoints ==========

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending reviews for moderation (admin only)' })
  @ApiResponse({ status: 200, description: 'List of pending reviews' })
  async findPending() {
    return this.reviewService.findPending();
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a review (admin only)' })
  @ApiResponse({ status: 200, description: 'Review approved successfully' })
  @ApiResponse({ status: 400, description: 'Review is not pending' })
  async approve(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.reviewService.approve(id, user.id);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a review (admin only)' })
  @ApiResponse({ status: 200, description: 'Review rejected successfully' })
  @ApiResponse({ status: 400, description: 'Review is not pending' })
  async reject(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.reviewService.reject(id, user.id);
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
  @ApiResponse({ status: 200, description: 'List of reviews' })
  async findByProfessionalId(@Param('professionalId') professionalId: string) {
    return this.reviewService.findByProfessionalId(professionalId);
  }
}
