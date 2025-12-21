import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import {
  ReviewRepository,
  REVIEW_REPOSITORY,
} from '../../domain/repositories/review.repository';
import { ReviewEntity } from '../../domain/entities/review.entity';
import {
  ProfessionalRepository,
  PROFESSIONAL_REPOSITORY,
} from '../../../profiles/domain/repositories/professional.repository';
import {
  RequestRepository,
  REQUEST_REPOSITORY,
} from '../../../requests/domain/repositories/request.repository';
import {
  UserRepository,
  USER_REPOSITORY,
} from '../../../identity/domain/repositories/user.repository';
import { CreateReviewDto } from '../dto/create-review.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { Rating } from '../../domain/value-objects/rating.vo';
import { randomUUID } from 'crypto';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async findByProfessionalId(professionalId: string): Promise<ReviewEntity[]> {
    return this.reviewRepository.findByProfessionalId(professionalId);
  }

  async findById(id: string): Promise<ReviewEntity> {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async findByRequestId(requestId: string): Promise<ReviewEntity | null> {
    return this.reviewRepository.findByRequestId(requestId);
  }

  async create(
    reviewerId: string,
    createDto: CreateReviewDto,
  ): Promise<ReviewEntity> {
    const reviewer = await this.userRepository.findById(reviewerId, true);
    if (!reviewer || !reviewer.hasClientProfile) {
      throw new BadRequestException('Only clients can create reviews');
    }

    const professional = await this.professionalRepository.findById(
      createDto.professionalId,
    );
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    // Validate request if provided (required for reviews)
    if (!createDto.requestId) {
      throw new BadRequestException(
        'Request ID is required to create a review',
      );
    }

    const request = await this.requestRepository.findById(createDto.requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.clientId !== reviewerId) {
      throw new ForbiddenException('You can only review requests you created');
    }

    if (!request.canBeReviewed()) {
      throw new BadRequestException(
        'Request must be completed before reviewing',
      );
    }

    // Check if this request already has a review (one review per request)
    const existingReview = await this.reviewRepository.findByRequestId(
      createDto.requestId,
    );
    if (existingReview) {
      throw new ConflictException('This request already has a review');
    }

    // Validate rating
    const rating = new Rating(createDto.rating);

    const review = await this.reviewRepository.save(
      ReviewEntity.create({
        id: randomUUID(),
        reviewerId,
        professionalId: createDto.professionalId,
        requestId: createDto.requestId || null,
        rating: rating.getValue(),
        comment: createDto.comment || null,
      }),
    );

    // Update professional rating
    await this.updateProfessionalRating(createDto.professionalId);

    return review;
  }

  async update(
    id: string,
    reviewerId: string,
    updateDto: UpdateReviewDto,
  ): Promise<ReviewEntity> {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    const updateData: { rating?: number; comment?: string | null } = {};

    if (updateDto.rating !== undefined) {
      const rating = new Rating(updateDto.rating);
      updateData.rating = rating.getValue();
    }

    if (updateDto.comment !== undefined) {
      updateData.comment = updateDto.comment;
    }

    const updatedReview = await this.reviewRepository.save(
      review.withChanges(updateData),
    );

    // Update professional rating
    await this.updateProfessionalRating(review.professionalId);

    return updatedReview;
  }

  async delete(id: string, reviewerId: string): Promise<void> {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    const professionalId = review.professionalId;

    await this.reviewRepository.delete(id);

    // Update professional rating
    await this.updateProfessionalRating(professionalId);
  }

  private async updateProfessionalRating(
    professionalId: string,
  ): Promise<void> {
    const reviews =
      await this.reviewRepository.findByProfessionalId(professionalId);

    if (reviews.length === 0) {
      await this.professionalRepository.updateRating(professionalId, 0, 0);
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    const totalReviews = reviews.length;

    await this.professionalRepository.updateRating(
      professionalId,
      averageRating,
      totalReviews,
    );
  }
}
