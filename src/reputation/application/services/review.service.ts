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
import { ReviewStatus } from '../../domain/value-objects/review-status';
import { CreateReviewDto } from '../dto/create-review.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { Rating } from '../../domain/value-objects/rating.vo';
import { randomUUID } from 'crypto';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { RequestService } from '../../../requests/application/services/request.service';
import { UserService } from '../../../identity/application/services/user.service';
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import { ReviewApprovedEvent } from '../../domain/events/review-approved.event';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    private readonly professionalService: ProfessionalService,
    private readonly requestService: RequestService,
    private readonly userService: UserService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  /**
   * Find reviews for a professional (public display).
   * Only returns APPROVED reviews.
   */
  async findByProfessionalId(professionalId: string): Promise<ReviewEntity[]> {
    return this.reviewRepository.findApprovedByProfessionalId(professionalId);
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
    const reviewer = await this.userService.findById(reviewerId, true);
    if (!reviewer || !reviewer.hasClientProfile) {
      throw new BadRequestException('Only clients can create reviews');
    }

    // Validate professional exists
    await this.professionalService.getByIdOrFail(createDto.professionalId);

    // Validate request if provided (required for reviews)
    if (!createDto.requestId) {
      throw new BadRequestException(
        'Request ID is required to create a review',
      );
    }

    const request = await this.requestService.findById(createDto.requestId);

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

    // Note: Rating is NOT updated until review is approved
    // await this.updateProfessionalRating(createDto.professionalId);

    return review;
  }

  /**
   * Approve a pending review. Only admins can approve.
   * This triggers a notification to the professional.
   */
  async approve(reviewId: string, moderatorId: string): Promise<ReviewEntity> {
    const review = await this.findById(reviewId);

    if (!review.isPending()) {
      throw new BadRequestException('Review is not pending moderation');
    }

    // Verify moderator is admin
    const moderator = await this.userService.findById(moderatorId);
    if (!moderator || !moderator.isAdmin) {
      throw new ForbiddenException('Only admins can approve reviews');
    }

    const approvedReview = review.approve(moderatorId);
    const saved = await this.reviewRepository.save(approvedReview);

    // Now update professional rating (only for approved reviews)
    await this.updateProfessionalRating(review.professionalId);

    // Get professional to find their userId
    const professional = await this.professionalService.getByIdOrFail(
      review.professionalId,
    );

    // Emit event for notifications
    await this.eventBus.publish(
      new ReviewApprovedEvent({
        reviewId: saved.id,
        reviewerId: saved.reviewerId,
        professionalId: saved.professionalId,
        professionalUserId: professional.userId,
        rating: saved.rating,
        comment: saved.comment,
        moderatorId,
      }),
    );

    return saved;
  }

  /**
   * Reject a pending review. Only admins can reject.
   */
  async reject(reviewId: string, moderatorId: string): Promise<ReviewEntity> {
    const review = await this.findById(reviewId);

    if (!review.isPending()) {
      throw new BadRequestException('Review is not pending moderation');
    }

    // Verify moderator is admin
    const moderator = await this.userService.findById(moderatorId);
    if (!moderator || !moderator.isAdmin) {
      throw new ForbiddenException('Only admins can reject reviews');
    }

    const rejectedReview = review.reject(moderatorId);
    return this.reviewRepository.save(rejectedReview);
  }

  /**
   * Find all pending reviews for moderation.
   */
  async findPending(): Promise<ReviewEntity[]> {
    return this.reviewRepository.findByStatus(ReviewStatus.PENDING);
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
    // Only count APPROVED reviews for rating calculation
    const reviews = await this.reviewRepository.findApprovedByProfessionalId(
      professionalId,
    );

    if (reviews.length === 0) {
      await this.professionalService.updateRating(professionalId, 0, 0);
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    const totalReviews = reviews.length;

    await this.professionalService.updateRating(
      professionalId,
      averageRating,
      totalReviews,
    );
  }
}
