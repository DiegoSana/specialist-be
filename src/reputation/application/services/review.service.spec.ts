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
    overrides?.professionalId || 'prof-123',
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
      findById: jest.fn(),
      findByRequestId: jest.fn(),
      findByStatus: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockProfessionalService = {
      getByIdOrFail: jest.fn(),
      updateRating: jest.fn(),
    };

    mockRequestService = {
      findById: jest.fn(),
    };

    mockUserService = {
      findById: jest.fn(),
    };

    mockEventBus = {
      emit: jest.fn(),
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
    it('should return reviews for a professional', async () => {
      const reviews = [
        createMockReview({ rating: 5 }),
        createMockReview({ id: 'review-456', rating: 4 }),
      ];
      mockReviewRepository.findByProfessionalId.mockResolvedValue(reviews);

      const result = await service.findByProfessionalId('prof-123');

      expect(result).toHaveLength(2);
      expect(mockReviewRepository.findByProfessionalId).toHaveBeenCalledWith(
        'prof-123',
      );
    });

    it('should return empty array when no reviews', async () => {
      mockReviewRepository.findByProfessionalId.mockResolvedValue([]);

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

    it('should create review successfully', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const professional = createMockProfessional();
      const request = createMockRequest({
        clientId: 'user-123',
        status: RequestStatus.DONE,
      });
      const review = createMockReview();

      mockUserService.findById.mockResolvedValue(user);
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockRequestService.findById.mockResolvedValue(request);
      mockReviewRepository.findByRequestId.mockResolvedValue(null);
      mockReviewRepository.save.mockResolvedValue(review);
      mockReviewRepository.findByProfessionalId.mockResolvedValue([review]);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(review);
      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        'prof-123',
        5,
        1,
      );
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

    it('should throw NotFoundException if professional not found', async () => {
      const user = createMockUser({ hasClientProfile: true });
      mockUserService.findById.mockResolvedValue(user);
      mockProfessionalService.getByIdOrFail.mockRejectedValue(
        new NotFoundException('Professional not found'),
      );

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

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

  describe('update', () => {
    const updateDto = {
      rating: 4,
      comment: 'Updated comment',
    };

    it('should update review successfully', async () => {
      const review = createMockReview({ reviewerId: 'user-123' });
      const updatedReview = createMockReview({
        ...review,
        rating: 4,
        comment: 'Updated comment',
      });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockReviewRepository.save.mockResolvedValue(updatedReview);
      mockReviewRepository.findByProfessionalId.mockResolvedValue([
        updatedReview,
      ]);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);

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
      const review = createMockReview({ reviewerId: 'other-user' });
      mockReviewRepository.findById.mockResolvedValue(review);

      await expect(
        service.update('review-123', 'user-123', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update only rating', async () => {
      const review = createMockReview({ reviewerId: 'user-123' });
      const updatedReview = createMockReview({ ...review, rating: 3 });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockReviewRepository.save.mockResolvedValue(updatedReview);
      mockReviewRepository.findByProfessionalId.mockResolvedValue([
        updatedReview,
      ]);

      await service.update('review-123', 'user-123', { rating: 3 });

      expect(mockReviewRepository.save).toHaveBeenCalled();
    });

    it('should update only comment', async () => {
      const review = createMockReview({ reviewerId: 'user-123' });
      const updatedReview = createMockReview({
        ...review,
        comment: 'New comment',
      });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockReviewRepository.save.mockResolvedValue(updatedReview);
      mockReviewRepository.findByProfessionalId.mockResolvedValue([
        updatedReview,
      ]);

      await service.update('review-123', 'user-123', {
        comment: 'New comment',
      });

      expect(mockReviewRepository.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete review successfully', async () => {
      const review = createMockReview({ reviewerId: 'user-123' });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockReviewRepository.delete.mockResolvedValue(undefined);
      mockReviewRepository.findByProfessionalId.mockResolvedValue([]);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);

      await service.delete('review-123', 'user-123');

      expect(mockReviewRepository.delete).toHaveBeenCalledWith('review-123');
      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        'prof-123',
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
      const review = createMockReview({ reviewerId: 'other-user' });
      mockReviewRepository.findById.mockResolvedValue(review);

      await expect(service.delete('review-123', 'user-123')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should recalculate professional rating after delete', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        professionalId: 'prof-123',
      });
      const remainingReviews = [
        createMockReview({ rating: 4 }),
        createMockReview({ rating: 5 }),
      ];

      mockReviewRepository.findById.mockResolvedValue(review);
      mockReviewRepository.delete.mockResolvedValue(undefined);
      mockReviewRepository.findByProfessionalId.mockResolvedValue(
        remainingReviews,
      );

      await service.delete('review-123', 'user-123');

      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        'prof-123',
        4.5,
        2,
      );
    });
  });
});
