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
import {
  ReviewEntity,
  ReviewAuthContext,
} from '../../domain/entities/review.entity';
import { ReviewStatus } from '../../domain/value-objects/review-status';
import { CreateReviewDto } from '../dto/create-review.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { Rating } from '../../domain/value-objects/rating.vo';
import { randomUUID } from 'crypto';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';
import { RequestService } from '../../../requests/application/services/request.service';
import { UserService } from '../../../identity/application/services/user.service';
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import { ReviewApprovedEvent } from '../../domain/events/review-approved.event';
import { ProviderType } from '@prisma/client';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    private readonly professionalService: ProfessionalService,
    private readonly companyService: CompanyService,
    private readonly requestService: RequestService,
    private readonly userService: UserService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  /**
   * Build authorization context for a user
   */
  async buildAuthContext(
    review: ReviewEntity,
    userId: string,
  ): Promise<ReviewAuthContext> {
    const user = await this.userService.findById(userId);
    const isAdmin = user?.isAdmin ?? false;
    return review.buildAuthContext(userId, isAdmin);
  }

  /**
   * Find reviews for a service provider (public display).
   * Only returns APPROVED reviews.
   */
  async findByServiceProviderId(serviceProviderId: string): Promise<ReviewEntity[]> {
    return this.reviewRepository.findApprovedByServiceProviderId(serviceProviderId);
  }

  /**
   * @deprecated Use findByServiceProviderId instead
   */
  async findByProfessionalId(professionalId: string): Promise<ReviewEntity[]> {
    // Get professional's serviceProviderId
    const professional = await this.professionalService.getByIdOrFail(professionalId);
    return this.reviewRepository.findApprovedByServiceProviderId(professional.serviceProviderId);
  }

  /**
   * Find review by ID (internal use, no permission check)
   */
  async findById(id: string): Promise<ReviewEntity> {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  /**
   * Find review by ID with permission validation
   */
  async findByIdForUser(id: string, userId: string): Promise<ReviewEntity> {
    const review = await this.findById(id);
    const ctx = await this.buildAuthContext(review, userId);

    if (!review.canBeViewedBy(ctx)) {
      throw new ForbiddenException('You do not have permission to view this review');
    }

    return review;
  }

  async findByRequestId(requestId: string): Promise<ReviewEntity | null> {
    return this.reviewRepository.findByRequestId(requestId);
  }

  /**
   * Find review by request ID with permission validation
   */
  async findByRequestIdForUser(
    requestId: string,
    userId: string,
  ): Promise<ReviewEntity | null> {
    const review = await this.findByRequestId(requestId);
    if (!review) {
      return null;
    }

    const ctx = await this.buildAuthContext(review, userId);
    if (!review.canBeViewedBy(ctx)) {
      throw new ForbiddenException(
        'You do not have permission to view this review',
      );
    }

    return review;
  }

  async create(
    reviewerId: string,
    createDto: CreateReviewDto,
  ): Promise<ReviewEntity> {
    const reviewer = await this.userService.findById(reviewerId, true);
    if (!reviewer || !reviewer.hasClientProfile) {
      throw new BadRequestException('Only clients can create reviews');
    }

    // Validate request (required for reviews)
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

    // The provider being reviewed must be the one assigned to the request
    if (!request.providerId) {
      throw new BadRequestException('Request has no provider assigned');
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
        serviceProviderId: request.providerId, // Use provider from request
        requestId: createDto.requestId,
        rating: rating.getValue(),
        comment: createDto.comment || null,
      }),
    );

    // Note: Rating is NOT updated until review is approved
    // await this.updateServiceProviderRating(request.providerId);

    return review;
  }

  /**
   * Approve a pending review. Only admins can approve.
   * This triggers a notification to the professional.
   */
  async approve(reviewId: string, moderatorId: string): Promise<ReviewEntity> {
    const review = await this.findById(reviewId);
    const ctx = await this.buildAuthContext(review, moderatorId);

    if (!review.canBeModeratedBy(ctx)) {
      if (!ctx.isAdmin) {
        throw new ForbiddenException('Only admins can approve reviews');
      }
      throw new BadRequestException('Review is not pending moderation');
    }

    const approvedReview = review.approve(moderatorId);
    const saved = await this.reviewRepository.save(approvedReview);

    // Now update provider rating (only for approved reviews)
    await this.updateServiceProviderRating(review.serviceProviderId);

    // Try to find the provider (Professional or Company) to get userId for notifications
    let providerUserId: string | null = null;
    let providerType: ProviderType = ProviderType.PROFESSIONAL;

    // Try Professional first
    const professional = await this.professionalService.findByServiceProviderId(
      review.serviceProviderId,
    );
    if (professional) {
      providerUserId = professional.userId;
      providerType = ProviderType.PROFESSIONAL;
    } else {
      // Try Company
      const company = await this.companyService.findByServiceProviderId(
        review.serviceProviderId,
      );
      if (company) {
        providerUserId = company.userId;
        providerType = ProviderType.COMPANY;
      }
    }

    // Emit event for notifications (if provider found)
    if (providerUserId) {
      await this.eventBus.publish(
        new ReviewApprovedEvent({
          reviewId: saved.id,
          reviewerId: saved.reviewerId,
          // New fields (preferred)
          serviceProviderId: saved.serviceProviderId,
          providerUserId,
          providerType,
          // Backward compatibility
          professionalId: saved.serviceProviderId,
          rating: saved.rating,
          comment: saved.comment,
          moderatorId,
        }),
      );
    }

    return saved;
  }

  /**
   * Reject a pending review. Only admins can reject.
   */
  async reject(reviewId: string, moderatorId: string): Promise<ReviewEntity> {
    const review = await this.findById(reviewId);
    const ctx = await this.buildAuthContext(review, moderatorId);

    if (!review.canBeModeratedBy(ctx)) {
      if (!ctx.isAdmin) {
        throw new ForbiddenException('Only admins can reject reviews');
      }
      throw new BadRequestException('Review is not pending moderation');
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
    userId: string,
    updateDto: UpdateReviewDto,
  ): Promise<ReviewEntity> {
    const review = await this.findById(id);
    const ctx = await this.buildAuthContext(review, userId);

    if (!review.canBeModifiedBy(ctx)) {
      if (!ctx.isReviewer) {
        throw new ForbiddenException('You can only update your own reviews');
      }
      throw new BadRequestException(
        'Cannot modify review after it has been moderated',
      );
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

    // Note: Don't update rating yet since review is still pending
    // Rating is only updated when approved

    return updatedReview;
  }

  async delete(id: string, userId: string): Promise<void> {
    const review = await this.findById(id);
    const ctx = await this.buildAuthContext(review, userId);

    if (!review.canBeModifiedBy(ctx)) {
      if (!ctx.isReviewer) {
        throw new ForbiddenException('You can only delete your own reviews');
      }
      throw new BadRequestException(
        'Cannot delete review after it has been moderated',
      );
    }

    const serviceProviderId = review.serviceProviderId;

    await this.reviewRepository.delete(id);

    // Update provider rating (in case it was approved and we're allowing admin delete)
    await this.updateServiceProviderRating(serviceProviderId);
  }

  /**
   * Update the rating for a service provider based on approved reviews
   */
  private async updateServiceProviderRating(
    serviceProviderId: string,
  ): Promise<void> {
    // Only count APPROVED reviews for rating calculation
    const reviews = await this.reviewRepository.findApprovedByServiceProviderId(
      serviceProviderId,
    );

    // Try to find the professional by serviceProviderId to update their rating
    const professional = await this.professionalService.findByServiceProviderId(serviceProviderId);
    
    if (!professional) {
      // TODO: Handle company providers when implemented
      return;
    }

    if (reviews.length === 0) {
      await this.professionalService.updateRating(professional.id, 0, 0);
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    const totalReviews = reviews.length;

    await this.professionalService.updateRating(
      professional.id,
      averageRating,
      totalReviews,
    );
  }
}
