import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { ReviewService } from '../application/services/review.service';
import { CreateReviewDto } from '../application/dto/create-review.dto';
import { UpdateReviewDto } from '../application/dto/update-review.dto';
import { Public } from '../../shared/presentation/decorators/public.decorator';

@ApiTags('Reputation')
@Controller('reputation')
export class ReputationController {
  constructor(private readonly reviewService: ReviewService) {}

  @Public()
  @Get('professionals/:professionalId/reviews')
  @ApiOperation({ summary: 'Get reviews for a professional' })
  @ApiResponse({ status: 200, description: 'List of reviews' })
  async getProfessionalReviews(@Param('professionalId') professionalId: string) {
    return this.reviewService.findByProfessionalId(professionalId);
  }

  @Get('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiResponse({ status: 200, description: 'Review details' })
  async getReview(@Param('id') id: string) {
    return this.reviewService.findById(id);
  }

  @Get('reviews/request/:requestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review by request ID' })
  @ApiResponse({ status: 200, description: 'Review details if exists' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async getReviewByRequestId(@Param('requestId') requestId: string) {
    const review = await this.reviewService.findByRequestId(requestId);
    if (!review) {
      throw new NotFoundException('Review not found for this request');
    }
    return review;
  }

  @Post('reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a review' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  async createReview(@CurrentUser() user: UserEntity, @Body() createDto: CreateReviewDto) {
    return this.reviewService.create(user.id, createDto);
  }

  @Put('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a review' })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  async updateReview(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateReviewDto,
  ) {
    return this.reviewService.update(id, user.id, updateDto);
  }

  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a review' })
  @ApiResponse({ status: 204, description: 'Review deleted successfully' })
  async deleteReview(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    await this.reviewService.delete(id, user.id);
  }
}

