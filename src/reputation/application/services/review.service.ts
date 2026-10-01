import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
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
import { ProviderType, ReviewDirection } from '@prisma/client';

export interface RequestReviewsForViewer {
  myReview: ReviewEntity | null;
  counterpartReview: ReviewEntity | null;
}

@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    @Inject(forwardRef(() => ProfessionalService))
    private readonly professionalService: ProfessionalService,
    private readonly companyService: CompanyService,
    @Inject(forwardRef(() => RequestService))
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
  async findByServiceProviderId(
    serviceProviderId: string,
  ): Promise<ReviewEntity[]> {
    return this.reviewRepository.findApprovedByServiceProviderId(
      serviceProviderId,
    );
  }

  /**
   * @deprecated Use findByServiceProviderId instead
   */
  async findByProfessionalId(professionalId: string): Promise<ReviewEntity[]> {
    // Get professional's serviceProviderId
    const professional =
      await this.professionalService.getByIdOrFail(professionalId);
    return this.reviewRepository.findApprovedByServiceProviderId(
      professional.serviceProviderId,
    );
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
      throw new ForbiddenException(
        'You do not have permission to view this review',
      );
    }

    return review;
  }

  /**
   * Find review by request ID + direction with permission validation. `direction` defaults to
   * CLIENT_TO_PROVIDER for backward compat with the original single-direction endpoint.
   */
  async findByRequestIdForUser(
    requestId: string,
    userId: string,
    direction: ReviewDirection = ReviewDirection.CLIENT_TO_PROVIDER,
  ): Promise<ReviewEntity | null> {
    const review = await this.reviewRepository.findByRequestIdAndDirection(
      requestId,
      direction,
    );
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

  /**
   * Both directions' reviews for a request, split into "mine" and "the counterpart's" from the
   * viewer's point of view. Used by RequestResponseDto to build myReview/counterpartReview —
   * the DTO is responsible for gating counterpartReview's content via
   * ReviewEntity.isVisibleTo(viewerUserId, isAdmin) (doble-ciego con timeout).
   */
  async getRequestReviewsForViewer(
    requestId: string,
    viewerUserId: string,
  ): Promise<RequestReviewsForViewer> {
    const reviews = await this.reviewRepository.findAllByRequestId(requestId);
    return {
      myReview: reviews.find((r) => r.reviewerId === viewerUserId) ?? null,
      counterpartReview:
        reviews.find((r) => r.reviewerId !== viewerUserId) ?? null,
    };
  }

  /**
   * Whether a review already exists for (requestId, direction), regardless of status — used by
   * the follow-up scheduler to stop nudging a party who already submitted their rating (see
   * follow-up-ladders.ts's reviewDirectionGate on the CLOSED notices).
   */
  async hasReviewForRequestAndDirection(
    requestId: string,
    direction: ReviewDirection,
  ): Promise<boolean> {
    const review = await this.reviewRepository.findByRequestIdAndDirection(
      requestId,
      direction,
    );
    return review !== null;
  }

  /**
   * Approved + featured PROVIDER_TO_CLIENT reviews for a client — "client in context" view
   * (REVIEWS_REDESIGN.md section 2: no client profile page, shown where a provider already sees
   * the request/interest).
   */
  async findFeaturedClientReviews(
    clientUserId: string,
    limit = 5,
  ): Promise<ReviewEntity[]> {
    return this.reviewRepository.findFeaturedByRevieweeUserId(
      clientUserId,
      ReviewDirection.PROVIDER_TO_CLIENT,
      limit,
    );
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

    // Check if this request already has a CLIENT_TO_PROVIDER review (at most one per direction)
    const existingReview =
      await this.reviewRepository.findByRequestIdAndDirection(
        createDto.requestId,
        ReviewDirection.CLIENT_TO_PROVIDER,
      );
    if (existingReview) {
      throw new ConflictException('This request already has a review');
    }

    const revieweeUserId = await this.resolveProviderUserId(request.providerId);
    if (!revieweeUserId) {
      throw new BadRequestException(
        'Could not resolve the provider being reviewed',
      );
    }

    // Validate rating
    const rating = new Rating(createDto.rating);

    const review = await this.reviewRepository.save(
      ReviewEntity.create({
        id: randomUUID(),
        direction: ReviewDirection.CLIENT_TO_PROVIDER,
        reviewerId,
        revieweeUserId,
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
   * PROVIDER_TO_CLIENT review, created from RequestService.rateClient (POST
   * /requests/:id/rate-client). Authorization (assigned provider, request CLOSED) is already
   * validated by RequestEntity.canRateClientBy in RequestService — this method only enforces the
   * review-specific invariant (one PROVIDER_TO_CLIENT review per request) and persists it as
   * PENDING, same moderation flow as the other direction.
   */
  async createProviderToClientReview(
    reviewerId: string,
    params: { requestId: string; rating: number; comment?: string | null },
  ): Promise<ReviewEntity> {
    const existingReview =
      await this.reviewRepository.findByRequestIdAndDirection(
        params.requestId,
        ReviewDirection.PROVIDER_TO_CLIENT,
      );
    if (existingReview) {
      throw new ConflictException(
        'Client has already been rated for this request',
      );
    }

    const request = await this.requestService.findById(params.requestId);
    const rating = new Rating(params.rating);

    const review = await this.reviewRepository.save(
      ReviewEntity.create({
        id: randomUUID(),
        direction: ReviewDirection.PROVIDER_TO_CLIENT,
        reviewerId,
        revieweeUserId: request.clientId,
        serviceProviderId: null,
        requestId: params.requestId,
        rating: rating.getValue(),
        comment: params.comment || null,
      }),
    );

    return review;
  }

  /**
   * Approve a pending review. Only admins can approve.
   * This triggers a notification to the professional (CLIENT_TO_PROVIDER only).
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

    if (saved.isClientToProvider() && saved.serviceProviderId) {
      // Now update provider rating (only for approved reviews)
      await this.updateServiceProviderRating(saved.serviceProviderId);
    } else if (saved.isProviderToClient()) {
      await this.updateClientRating(saved.revieweeUserId);
    }

    // Doble-ciego con timeout: if both directions are now APPROVED, reveal immediately instead of
    // waiting for RevealReviewsJob's timeout path.
    await this.revealBothIfBothApproved(saved.requestId);

    // Emit event for notifications (CLIENT_TO_PROVIDER only — PROVIDER_TO_CLIENT has no
    // ServiceProvider to notify through this event's shape).
    if (saved.isClientToProvider() && saved.serviceProviderId) {
      let providerUserId: string | null = null;
      let providerType: ProviderType = ProviderType.PROFESSIONAL;

      const professional =
        await this.professionalService.findByServiceProviderId(
          saved.serviceProviderId,
        );
      if (professional) {
        providerUserId = professional.userId;
        providerType = ProviderType.PROFESSIONAL;
      } else {
        const company = await this.companyService.findByServiceProviderId(
          saved.serviceProviderId,
        );
        if (company) {
          providerUserId = company.userId;
          providerType = ProviderType.COMPANY;
        }
      }

      if (providerUserId) {
        await this.eventBus.publish(
          new ReviewApprovedEvent({
            reviewId: saved.id,
            reviewerId: saved.reviewerId,
            serviceProviderId: saved.serviceProviderId,
            providerUserId,
            providerType,
            professionalId: saved.serviceProviderId,
            rating: saved.rating,
            comment: saved.comment,
            moderatorId,
          }),
        );
      }
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
   * Toggle the admin-curated isFeatured flag. Only APPROVED reviews can be featured.
   */
  async setFeatured(
    reviewId: string,
    adminId: string,
    isFeatured: boolean,
  ): Promise<ReviewEntity> {
    const review = await this.findById(reviewId);
    const ctx = await this.buildAuthContext(review, adminId);

    if (!review.canBeFeaturedBy(ctx)) {
      if (!ctx.isAdmin) {
        throw new ForbiddenException('Only admins can feature reviews');
      }
      throw new BadRequestException('Only approved reviews can be featured');
    }

    return this.reviewRepository.save(review.withFeatured(isFeatured));
  }

  /**
   * Find all pending reviews for moderation.
   */
  async findPending(): Promise<ReviewEntity[]> {
    return this.reviewRepository.findByStatus(ReviewStatus.PENDING);
  }

  /**
   * Admin moderation listing by status (defaults to PENDING via the controller). Added so an
   * already-APPROVED review (which `findPending` never returns) is still reachable from the
   * admin UI — needed to toggle `isFeatured`, which only accepts APPROVED reviews.
   */
  async findByStatus(status: ReviewStatus): Promise<ReviewEntity[]> {
    return this.reviewRepository.findByStatus(status);
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

    const wasClientToProvider = review.isClientToProvider();
    const serviceProviderId = review.serviceProviderId;
    const revieweeUserId = review.revieweeUserId;

    await this.reviewRepository.delete(id);

    // Update the affected rating (in case it was approved and we're allowing admin delete)
    if (wasClientToProvider && serviceProviderId) {
      await this.updateServiceProviderRating(serviceProviderId);
    } else {
      await this.updateClientRating(revieweeUserId);
    }
  }

  /**
   * Delete every review for a request regardless of status/direction, bypassing reviewer-only
   * authorization — used by RequestPublishedAgainHandler when a request restarts its engagement
   * with a new provider (unassign-then-reassign). Recomputes whichever ratings were affected.
   * Not authorization-checked: only a system/handler caller should use this.
   */
  async deleteAllForRequest(requestId: string): Promise<void> {
    const reviews = await this.reviewRepository.findAllByRequestId(requestId);
    for (const review of reviews) {
      await this.reviewRepository.delete(review.id);
      if (review.isClientToProvider() && review.serviceProviderId) {
        await this.updateServiceProviderRating(review.serviceProviderId);
      } else if (review.isProviderToClient()) {
        await this.updateClientRating(review.revieweeUserId);
      }
    }
  }

  /**
   * Update the rating for a service provider based on approved reviews
   */
  /**
   * Recalculates a ServiceProvider's averageRating/totalReviews from its currently APPROVED
   * reviews. Public so callers that remove or moderate a review outside this service's own
   * `approve`/`delete` methods (e.g. `RequestPublishedAgainHandler`, which deletes a stale review
   * via the repository directly to bypass reviewer-only authorization) can keep the cached rating
   * in sync instead of leaving it stale.
   */
  async updateServiceProviderRating(serviceProviderId: string): Promise<void> {
    // Only count APPROVED reviews for rating calculation
    const reviews =
      await this.reviewRepository.findApprovedByServiceProviderId(
        serviceProviderId,
      );

    // Try to find the professional by serviceProviderId to update their rating
    const professional =
      await this.professionalService.findByServiceProviderId(serviceProviderId);

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

  /**
   * Recalculates User.clientAverageRating/clientTotalReviews from a client's currently APPROVED
   * PROVIDER_TO_CLIENT reviews. Mirrors updateServiceProviderRating for the other direction.
   */
  async updateClientRating(clientUserId: string): Promise<void> {
    const reviews = await this.reviewRepository.findApprovedByRevieweeUserId(
      clientUserId,
      ReviewDirection.PROVIDER_TO_CLIENT,
    );

    if (reviews.length === 0) {
      await this.userService.updateClientRating(clientUserId, 0, 0);
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    await this.userService.updateClientRating(
      clientUserId,
      averageRating,
      reviews.length,
    );
  }

  /**
   * Doble-ciego con timeout, immediate-reveal branch (4.2.a): if both directions' reviews for a
   * request are APPROVED, reveal both right away instead of waiting for the timeout. Safe to call
   * unconditionally after any approve — it's a no-op unless both sides are now approved and
   * unrevealed. The timeout branch (4.2.b) is handled separately by RevealReviewsJob.
   */
  private async revealBothIfBothApproved(requestId: string): Promise<void> {
    const reviews = await this.reviewRepository.findAllByRequestId(requestId);
    if (reviews.length !== 2) return;
    if (!reviews.every((r) => r.isApproved())) return;

    const now = new Date();
    for (const review of reviews) {
      if (!review.isRevealed()) {
        await this.reviewRepository.save(review.reveal(now));
      }
    }
  }

  /**
   * Resolves the User id of the ServiceProvider being reviewed (Professional or Company owner).
   */
  private async resolveProviderUserId(
    serviceProviderId: string,
  ): Promise<string | null> {
    const professional =
      await this.professionalService.findByServiceProviderId(serviceProviderId);
    if (professional) return professional.userId;

    const company =
      await this.companyService.findByServiceProviderId(serviceProviderId);
    return company?.userId ?? null;
  }
}
