import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { REVIEW_REPOSITORY } from '../../domain/repositories/review.repository';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { RequestService } from '../../../requests/application/services/request.service';
import { UserService } from '../../../identity/application/services/user.service';
import {
  createMockUser,
  createMockProfessional,
  createMockRequest,
} from '../../../__mocks__/test-utils';
import { ReviewEntity } from '../../domain/entities/review.entity';
import { ReviewStatus } from '../../domain/value-objects/review-status';
import { RequestStatus } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';

const createMockReview = (overrides?: Partial<ReviewEntity>): ReviewEntity => {
  return new ReviewEntity(
    overrides?.id || 'review-123',
    overrides?.reviewerId || 'user-123',
    overrides?.serviceProviderId || 'service-provider-123',
    overrides?.requestId || 'request-123',
    overrides?.rating || 5,
    overrides?.comment || 'Great service!',
    overrides?.status || ReviewStatus.PENDING,
    overrides?.moderatedAt || null,
    overrides?.moderatedBy || null,
    overrides?.createdAt || new Date(),
    overrides?.updatedAt || new Date(),
  );
};

describe('ReviewService', () => {
  let service: ReviewService;
  let mockReviewRepository: any;
  let mockProfessionalService: any;
  let mockRequestService: any;
  let mockUserService: any;
  let mockEventBus: any;

  beforeEach(async () => {
    mockReviewRepository = {
      findByProfessionalId: jest.fn(),
      findApprovedByProfessionalId: jest.fn(),
      findByServiceProviderId: jest.fn(),
      findApprovedByServiceProviderId: jest.fn(),
      findById: jest.fn(),
      findByRequestId: jest.fn(),
      findByStatus: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockProfessionalService = {
      getByIdOrFail: jest.fn(),
      findByServiceProviderId: jest.fn(),
      updateRating: jest.fn(),
    };

    mockRequestService = {
      findById: jest.fn(),
    };

    mockUserService = {
      findById: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
      on: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: REVIEW_REPOSITORY, useValue: mockReviewRepository },
        { provide: ProfessionalService, useValue: mockProfessionalService },
        { provide: RequestService, useValue: mockRequestService },
        { provide: UserService, useValue: mockUserService },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByProfessionalId', () => {
    it('should return only approved reviews for a professional', async () => {
      const professional = createMockProfessional({ id: 'prof-123' });
      const reviews = [
        createMockReview({ rating: 5, status: ReviewStatus.APPROVED }),
        createMockReview({ id: 'review-456', rating: 4, status: ReviewStatus.APPROVED }),
      ];
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue(reviews);

      const result = await service.findByProfessionalId('prof-123');

      expect(result).toHaveLength(2);
      expect(mockReviewRepository.findApprovedByServiceProviderId).toHaveBeenCalledWith(
        'service-provider-123',
      );
    });

    it('should return empty array when no approved reviews', async () => {
      const professional = createMockProfessional({ id: 'prof-123' });
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue([]);

      const result = await service.findByProfessionalId('prof-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return review when found', async () => {
      const review = createMockReview();
      mockReviewRepository.findById.mockResolvedValue(review);

      const result = await service.findById('review-123');

      expect(result).toEqual(review);
    });

    it('should throw NotFoundException when review not found', async () => {
      mockReviewRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByRequestId', () => {
    it('should return review when found', async () => {
      const review = createMockReview();
      mockReviewRepository.findByRequestId.mockResolvedValue(review);

      const result = await service.findByRequestId('request-123');

      expect(result).toEqual(review);
    });

    it('should return null when no review for request', async () => {
      mockReviewRepository.findByRequestId.mockResolvedValue(null);

      const result = await service.findByRequestId('request-123');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    const createDto = {
      professionalId: 'prof-123',
      requestId: 'request-123',
      rating: 5,
      comment: 'Great service!',
    };

    it('should create review with PENDING status (not update rating until approved)', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const professional = createMockProfessional();
      const request = createMockRequest({
        clientId: 'user-123',
        status: RequestStatus.DONE,
      });
      const review = createMockReview({ status: ReviewStatus.PENDING });

      mockUserService.findById.mockResolvedValue(user);
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockRequestService.findById.mockResolvedValue(request);
      mockReviewRepository.findByRequestId.mockResolvedValue(null);
      mockReviewRepository.save.mockResolvedValue(review);

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(review);
      // Rating is NOT updated on create - only when approved
      expect(mockProfessionalService.updateRating).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if user is not a client', async () => {
      const user = createMockUser({ hasClientProfile: false });
      mockUserService.findById.mockResolvedValue(user);

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUserService.findById.mockResolvedValue(null);

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    // Note: "professional not found" test removed as the service no longer validates
    // professional existence in create - it uses request.providerId directly

    it('should throw BadRequestException if requestId is not provided', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const professional = createMockProfessional();

      mockUserService.findById.mockResolvedValue(user);
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);

      const dtoWithoutRequest = { ...createDto, requestId: undefined };

      await expect(
        service.create('user-123', dtoWithoutRequest as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if request not found', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const professional = createMockProfessional();

      mockUserService.findById.mockResolvedValue(user);
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockRequestService.findById.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not request owner', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const professional = createMockProfessional();
      const request = createMockRequest({ clientId: 'other-user' });

      mockUserService.findById.mockResolvedValue(user);
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockRequestService.findById.mockResolvedValue(request);

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if request is not completed', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const professional = createMockProfessional();
      const request = createMockRequest({
        clientId: 'user-123',
        status: RequestStatus.PENDING,
      });

      mockUserService.findById.mockResolvedValue(user);
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockRequestService.findById.mockResolvedValue(request);

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if request already has a review', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const professional = createMockProfessional();
      const request = createMockRequest({
        clientId: 'user-123',
        status: RequestStatus.DONE,
      });
      const existingReview = createMockReview();

      mockUserService.findById.mockResolvedValue(user);
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockRequestService.findById.mockResolvedValue(request);
      mockReviewRepository.findByRequestId.mockResolvedValue(existingReview);

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw Error for invalid rating (value object validation)', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const professional = createMockProfessional();
      const request = createMockRequest({
        clientId: 'user-123',
        status: RequestStatus.DONE,
      });

      mockUserService.findById.mockResolvedValue(user);
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockRequestService.findById.mockResolvedValue(request);
      mockReviewRepository.findByRequestId.mockResolvedValue(null);

      const invalidDto = { ...createDto, rating: 6 };

      await expect(service.create('user-123', invalidDto)).rejects.toThrow(
        'Rating must be between 1 and 5',
      );
    });
  });

  describe('findByIdForUser', () => {
    it('should return approved review for any user', async () => {
      const review = createMockReview({
        reviewerId: 'other-user',
        status: ReviewStatus.APPROVED,
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      const result = await service.findByIdForUser('review-123', 'user-123');

      expect(result).toEqual(review);
    });

    it('should return pending review for the reviewer', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        status: ReviewStatus.PENDING,
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      const result = await service.findByIdForUser('review-123', 'user-123');

      expect(result).toEqual(review);
    });

    it('should return pending review for admin', async () => {
      const review = createMockReview({
        reviewerId: 'other-user',
        status: ReviewStatus.PENDING,
      });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);

      const result = await service.findByIdForUser('review-123', 'admin-123');

      expect(result).toEqual(review);
    });

    it('should throw ForbiddenException for pending review by non-owner', async () => {
      const review = createMockReview({
        reviewerId: 'other-user',
        status: ReviewStatus.PENDING,
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      await expect(
        service.findByIdForUser('review-123', 'user-123'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    const updateDto = {
      rating: 4,
      comment: 'Updated comment',
    };

    it('should update pending review by owner', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        status: ReviewStatus.PENDING,
      });
      const updatedReview = createMockReview({
        ...review,
        rating: 4,
        comment: 'Updated comment',
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);
      mockReviewRepository.save.mockResolvedValue(updatedReview);

      const result = await service.update('review-123', 'user-123', updateDto);

      expect(result.rating).toBe(4);
      expect(result.comment).toBe('Updated comment');
    });

    it('should throw NotFoundException if review not found', async () => {
      mockReviewRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existent', 'user-123', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not review owner', async () => {
      const review = createMockReview({
        reviewerId: 'other-user',
        status: ReviewStatus.PENDING,
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      await expect(
        service.update('review-123', 'user-123', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if review is already approved', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        status: ReviewStatus.APPROVED,
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      await expect(
        service.update('review-123', 'user-123', updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update only rating', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        status: ReviewStatus.PENDING,
      });
      const updatedReview = createMockReview({ ...review, rating: 3 });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);
      mockReviewRepository.save.mockResolvedValue(updatedReview);

      await service.update('review-123', 'user-123', { rating: 3 });

      expect(mockReviewRepository.save).toHaveBeenCalled();
    });

    it('should update only comment', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        status: ReviewStatus.PENDING,
      });
      const updatedReview = createMockReview({
        ...review,
        comment: 'New comment',
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);
      mockReviewRepository.save.mockResolvedValue(updatedReview);

      await service.update('review-123', 'user-123', {
        comment: 'New comment',
      });

      expect(mockReviewRepository.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete pending review by owner', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        status: ReviewStatus.PENDING,
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });
      const professional = createMockProfessional();

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);
      mockReviewRepository.delete.mockResolvedValue(undefined);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue([]);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(professional);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);

      await service.delete('review-123', 'user-123');

      expect(mockReviewRepository.delete).toHaveBeenCalledWith('review-123');
      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        'professional-123', // Uses professional.id, not serviceProviderId
        0,
        0,
      );
    });

    it('should throw NotFoundException if review not found', async () => {
      mockReviewRepository.findById.mockResolvedValue(null);

      await expect(service.delete('non-existent', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not review owner', async () => {
      const review = createMockReview({
        reviewerId: 'other-user',
        status: ReviewStatus.PENDING,
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      await expect(service.delete('review-123', 'user-123')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if review is already approved', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        status: ReviewStatus.APPROVED,
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      await expect(service.delete('review-123', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should recalculate professional rating after delete', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        serviceProviderId: 'service-provider-123',
        status: ReviewStatus.PENDING,
      });
      const remainingReviews = [
        createMockReview({ rating: 4, status: ReviewStatus.APPROVED }),
        createMockReview({ rating: 5, status: ReviewStatus.APPROVED }),
      ];
      const user = createMockUser({ id: 'user-123', isAdmin: false });
      const professional = createMockProfessional();

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);
      mockReviewRepository.delete.mockResolvedValue(undefined);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue(
        remainingReviews,
      );
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(professional);

      await service.delete('review-123', 'user-123');

      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        'professional-123', // Uses professional.id, not serviceProviderId
        4.5,
        2,
      );
    });
  });

  describe('approve', () => {
    it('should approve pending review by admin', async () => {
      const review = createMockReview({ status: ReviewStatus.PENDING });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });
      const professional = createMockProfessional();
      const approvedReview = review.approve('admin-123');

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);
      mockReviewRepository.save.mockResolvedValue(approvedReview);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue([
        approvedReview,
      ]);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(professional);

      const result = await service.approve('review-123', 'admin-123');

      expect(result.status).toBe(ReviewStatus.APPROVED);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not admin', async () => {
      const review = createMockReview({ status: ReviewStatus.PENDING });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      await expect(
        service.approve('review-123', 'user-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if review is not pending', async () => {
      const review = createMockReview({ status: ReviewStatus.APPROVED });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);

      await expect(
        service.approve('review-123', 'admin-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('should reject pending review by admin', async () => {
      const review = createMockReview({ status: ReviewStatus.PENDING });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });
      const rejectedReview = review.reject('admin-123');

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);
      mockReviewRepository.save.mockResolvedValue(rejectedReview);

      const result = await service.reject('review-123', 'admin-123');

      expect(result.status).toBe(ReviewStatus.REJECTED);
    });

    it('should throw ForbiddenException if user is not admin', async () => {
      const review = createMockReview({ status: ReviewStatus.PENDING });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      await expect(
        service.reject('review-123', 'user-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if review is not pending', async () => {
      const review = createMockReview({ status: ReviewStatus.REJECTED });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);

      await expect(
        service.reject('review-123', 'admin-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
