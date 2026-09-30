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
import { CompanyService } from '../../../profiles/application/services/company.service';
import { RequestService } from '../../../requests/application/services/request.service';
import { UserService } from '../../../identity/application/services/user.service';
import {
  createMockUser,
  createMockProfessional,
  createMockRequest,
  createMockReview,
} from '../../../__mocks__/test-utils';
import { ReviewStatus } from '../../domain/value-objects/review-status';
import { RequestStatus, ReviewDirection } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';

describe('ReviewService', () => {
  let service: ReviewService;
  let mockReviewRepository: any;
  let mockProfessionalService: any;
  let mockCompanyService: any;
  let mockRequestService: any;
  let mockUserService: any;
  let mockEventBus: any;

  beforeEach(async () => {
    mockReviewRepository = {
      findByProfessionalId: jest.fn(),
      findByServiceProviderId: jest.fn(),
      findApprovedByServiceProviderId: jest.fn(),
      findApprovedByRevieweeUserId: jest.fn().mockResolvedValue([]),
      findFeaturedByRevieweeUserId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      findByRequestIdAndDirection: jest.fn(),
      findAllByRequestId: jest.fn().mockResolvedValue([]),
      findByStatus: jest.fn(),
      findRequestIdsPendingReveal: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockProfessionalService = {
      getByIdOrFail: jest.fn(),
      findByServiceProviderId: jest.fn(),
      updateRating: jest.fn(),
    };

    mockCompanyService = {
      findByServiceProviderId: jest.fn(),
    };

    mockRequestService = {
      findById: jest.fn(),
    };

    mockUserService = {
      findById: jest.fn(),
      updateClientRating: jest.fn(),
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
        { provide: CompanyService, useValue: mockCompanyService },
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
        createMockReview({
          id: 'review-456',
          rating: 4,
          status: ReviewStatus.APPROVED,
        }),
      ];
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue(
        reviews,
      );

      const result = await service.findByProfessionalId('prof-123');

      expect(result).toHaveLength(2);
      expect(
        mockReviewRepository.findApprovedByServiceProviderId,
      ).toHaveBeenCalledWith('service-provider-123');
    });

    it('should return empty array when no approved reviews', async () => {
      const professional = createMockProfessional({ id: 'prof-123' });
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue(
        [],
      );

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

  describe('findByRequestIdForUser', () => {
    it('defaults to CLIENT_TO_PROVIDER and returns the review when found', async () => {
      const review = createMockReview({ status: ReviewStatus.APPROVED });
      const user = createMockUser({ id: 'user-123', isAdmin: false });
      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(
        review,
      );
      mockUserService.findById.mockResolvedValue(user);

      const result = await service.findByRequestIdForUser(
        'request-123',
        'user-123',
      );

      expect(result).toEqual(review);
      expect(
        mockReviewRepository.findByRequestIdAndDirection,
      ).toHaveBeenCalledWith('request-123', ReviewDirection.CLIENT_TO_PROVIDER);
    });

    it('uses the given direction when provided', async () => {
      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(null);

      const result = await service.findByRequestIdForUser(
        'request-123',
        'user-123',
        ReviewDirection.PROVIDER_TO_CLIENT,
      );

      expect(result).toBeNull();
      expect(
        mockReviewRepository.findByRequestIdAndDirection,
      ).toHaveBeenCalledWith('request-123', ReviewDirection.PROVIDER_TO_CLIENT);
    });

    it('returns null when no review for request', async () => {
      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(null);

      const result = await service.findByRequestIdForUser(
        'request-123',
        'user-123',
      );

      expect(result).toBeNull();
    });
  });

  describe('getRequestReviewsForViewer', () => {
    it('splits the two reviews into myReview / counterpartReview from the viewer perspective', async () => {
      const mine = createMockReview({
        id: 'review-mine',
        reviewerId: 'viewer-1',
      });
      const theirs = createMockReview({
        id: 'review-theirs',
        reviewerId: 'other-1',
      });
      mockReviewRepository.findAllByRequestId.mockResolvedValue([mine, theirs]);

      const result = await service.getRequestReviewsForViewer(
        'request-123',
        'viewer-1',
      );

      expect(result.myReview).toEqual(mine);
      expect(result.counterpartReview).toEqual(theirs);
    });

    it('returns nulls when no reviews exist yet', async () => {
      mockReviewRepository.findAllByRequestId.mockResolvedValue([]);

      const result = await service.getRequestReviewsForViewer(
        'request-123',
        'viewer-1',
      );

      expect(result).toEqual({ myReview: null, counterpartReview: null });
    });
  });

  describe('create (CLIENT_TO_PROVIDER)', () => {
    const createDto = {
      professionalId: 'prof-123',
      requestId: 'request-123',
      rating: 5,
      comment: 'Great service!',
    };

    beforeEach(() => {
      mockProfessionalService.findByServiceProviderId.mockResolvedValue({
        userId: 'provider-user-1',
      });
    });

    it('should create review with PENDING status (not update rating until approved)', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const request = createMockRequest({
        clientId: 'user-123',
        status: RequestStatus.CLOSED,
      });
      const review = createMockReview({ status: ReviewStatus.PENDING });

      mockUserService.findById.mockResolvedValue(user);
      mockRequestService.findById.mockResolvedValue(request);
      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(null);
      mockReviewRepository.save.mockResolvedValue(review);

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(review);
      expect(mockReviewRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: ReviewDirection.CLIENT_TO_PROVIDER,
          revieweeUserId: 'provider-user-1',
        }),
      );
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

    it('should throw BadRequestException if requestId is not provided', async () => {
      const user = createMockUser({ hasClientProfile: true });
      mockUserService.findById.mockResolvedValue(user);

      const dtoWithoutRequest = { ...createDto, requestId: undefined };

      await expect(
        service.create('user-123', dtoWithoutRequest as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if request not found', async () => {
      const user = createMockUser({ hasClientProfile: true });
      mockUserService.findById.mockResolvedValue(user);
      mockRequestService.findById.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not request owner', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const request = createMockRequest({ clientId: 'other-user' });

      mockUserService.findById.mockResolvedValue(user);
      mockRequestService.findById.mockResolvedValue(request);

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if request is not completed', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const request = createMockRequest({
        clientId: 'user-123',
        status: RequestStatus.PUBLISHED,
      });

      mockUserService.findById.mockResolvedValue(user);
      mockRequestService.findById.mockResolvedValue(request);

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if request already has a CLIENT_TO_PROVIDER review', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const request = createMockRequest({
        clientId: 'user-123',
        status: RequestStatus.CLOSED,
      });
      const existingReview = createMockReview();

      mockUserService.findById.mockResolvedValue(user);
      mockRequestService.findById.mockResolvedValue(request);
      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(
        existingReview,
      );

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw Error for invalid rating (value object validation)', async () => {
      const user = createMockUser({ hasClientProfile: true });
      const request = createMockRequest({
        clientId: 'user-123',
        status: RequestStatus.CLOSED,
      });

      mockUserService.findById.mockResolvedValue(user);
      mockRequestService.findById.mockResolvedValue(request);
      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(null);

      const invalidDto = { ...createDto, rating: 6 };

      await expect(service.create('user-123', invalidDto)).rejects.toThrow(
        'Rating must be between 1 and 5',
      );
    });
  });

  describe('createProviderToClientReview (PROVIDER_TO_CLIENT)', () => {
    it('creates a PENDING review for the client', async () => {
      const request = createMockRequest({
        id: 'request-123',
        clientId: 'client-1',
        status: RequestStatus.CLOSED,
      });
      const review = createMockReview({
        direction: ReviewDirection.PROVIDER_TO_CLIENT,
        reviewerId: 'provider-user-1',
        revieweeUserId: 'client-1',
        serviceProviderId: null,
      });

      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(null);
      mockRequestService.findById.mockResolvedValue(request);
      mockReviewRepository.save.mockResolvedValue(review);

      const result = await service.createProviderToClientReview(
        'provider-user-1',
        { requestId: 'request-123', rating: 5, comment: 'Great client' },
      );

      expect(result).toEqual(review);
      expect(mockReviewRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: ReviewDirection.PROVIDER_TO_CLIENT,
          reviewerId: 'provider-user-1',
          revieweeUserId: 'client-1',
          serviceProviderId: null,
        }),
      );
    });

    it('throws ConflictException if the client was already rated for this request', async () => {
      const existing = createMockReview({
        direction: ReviewDirection.PROVIDER_TO_CLIENT,
      });
      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(
        existing,
      );

      await expect(
        service.createProviderToClientReview('provider-user-1', {
          requestId: 'request-123',
          rating: 5,
        }),
      ).rejects.toThrow(ConflictException);
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
        reviewerId: 'user-123',
        status: ReviewStatus.PENDING,
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
      const updatedReview = createMockReview({
        reviewerId: 'user-123',
        status: ReviewStatus.PENDING,
        rating: 3,
      });
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
        reviewerId: 'user-123',
        status: ReviewStatus.PENDING,
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
    it('should delete pending CLIENT_TO_PROVIDER review by owner and recompute provider rating', async () => {
      const review = createMockReview({
        reviewerId: 'user-123',
        status: ReviewStatus.PENDING,
      });
      const user = createMockUser({ id: 'user-123', isAdmin: false });
      const professional = createMockProfessional();

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);
      mockReviewRepository.delete.mockResolvedValue(undefined);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue(
        [],
      );
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(
        professional,
      );
      mockProfessionalService.updateRating.mockResolvedValue(undefined);

      await service.delete('review-123', 'user-123');

      expect(mockReviewRepository.delete).toHaveBeenCalledWith('review-123');
      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        'professional-123', // Uses professional.id, not serviceProviderId
        0,
        0,
      );
    });

    it('should delete a PROVIDER_TO_CLIENT review and recompute the client rating', async () => {
      const review = createMockReview({
        direction: ReviewDirection.PROVIDER_TO_CLIENT,
        reviewerId: 'provider-user-1',
        revieweeUserId: 'client-1',
        serviceProviderId: null,
        status: ReviewStatus.PENDING,
      });
      const user = createMockUser({ id: 'provider-user-1', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);
      mockReviewRepository.delete.mockResolvedValue(undefined);
      mockReviewRepository.findApprovedByRevieweeUserId.mockResolvedValue([]);

      await service.delete('review-123', 'provider-user-1');

      expect(mockUserService.updateClientRating).toHaveBeenCalledWith(
        'client-1',
        0,
        0,
      );
      expect(mockProfessionalService.updateRating).not.toHaveBeenCalled();
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
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(
        professional,
      );

      await service.delete('review-123', 'user-123');

      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        'professional-123', // Uses professional.id, not serviceProviderId
        4.5,
        2,
      );
    });
  });

  describe('approve', () => {
    it('should approve a pending CLIENT_TO_PROVIDER review by admin and recompute the provider rating', async () => {
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
      mockReviewRepository.findAllByRequestId.mockResolvedValue([
        approvedReview,
      ]);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(
        professional,
      );

      const result = await service.approve('review-123', 'admin-123');

      expect(result.status).toBe(ReviewStatus.APPROVED);
      expect(mockProfessionalService.updateRating).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should approve a pending PROVIDER_TO_CLIENT review and recompute the client rating (no event)', async () => {
      const review = createMockReview({
        direction: ReviewDirection.PROVIDER_TO_CLIENT,
        reviewerId: 'provider-user-1',
        revieweeUserId: 'client-1',
        serviceProviderId: null,
        status: ReviewStatus.PENDING,
      });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });
      const approvedReview = review.approve('admin-123');

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);
      mockReviewRepository.save.mockResolvedValue(approvedReview);
      mockReviewRepository.findApprovedByRevieweeUserId.mockResolvedValue([
        approvedReview,
      ]);
      mockReviewRepository.findAllByRequestId.mockResolvedValue([
        approvedReview,
      ]);

      const result = await service.approve('review-123', 'admin-123');

      expect(result.status).toBe(ReviewStatus.APPROVED);
      expect(mockUserService.updateClientRating).toHaveBeenCalledWith(
        'client-1',
        approvedReview.rating,
        1,
      );
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('reveals both reviews once the second one is approved (doble-ciego, immediate path)', async () => {
      const clientReview = createMockReview({
        id: 'review-1',
        direction: ReviewDirection.CLIENT_TO_PROVIDER,
        requestId: 'request-1',
        status: ReviewStatus.PENDING,
      });
      const providerReview = createMockReview({
        id: 'review-2',
        direction: ReviewDirection.PROVIDER_TO_CLIENT,
        requestId: 'request-1',
        reviewerId: 'provider-user-1',
        revieweeUserId: 'client-1',
        serviceProviderId: null,
        status: ReviewStatus.APPROVED, // already approved (the first one)
      });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });
      const approvedClientReview = clientReview.approve('admin-123');

      mockReviewRepository.findById.mockResolvedValue(clientReview);
      mockUserService.findById.mockResolvedValue(admin);
      mockReviewRepository.save.mockResolvedValue(approvedClientReview);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue([
        approvedClientReview,
      ]);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(
        createMockProfessional(),
      );
      // Both directions now APPROVED, neither revealed yet
      mockReviewRepository.findAllByRequestId.mockResolvedValue([
        approvedClientReview,
        providerReview,
      ]);

      await service.approve('review-1', 'admin-123');

      // save() is called once for the approve itself, plus once per unrevealed review
      const revealCalls = mockReviewRepository.save.mock.calls.filter(
        ([entity]: any[]) => entity.revealedAt !== null,
      );
      expect(revealCalls.length).toBe(2);
    });

    it('should throw ForbiddenException if user is not admin', async () => {
      const review = createMockReview({ status: ReviewStatus.PENDING });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      await expect(service.approve('review-123', 'user-123')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if review is not pending', async () => {
      const review = createMockReview({ status: ReviewStatus.APPROVED });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);

      await expect(service.approve('review-123', 'admin-123')).rejects.toThrow(
        BadRequestException,
      );
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

      await expect(service.reject('review-123', 'user-123')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if review is not pending', async () => {
      const review = createMockReview({ status: ReviewStatus.REJECTED });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);

      await expect(service.reject('review-123', 'admin-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setFeatured', () => {
    it('allows an admin to feature an approved review', async () => {
      const review = createMockReview({ status: ReviewStatus.APPROVED });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });
      const featured = review.withFeatured(true);

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);
      mockReviewRepository.save.mockResolvedValue(featured);

      const result = await service.setFeatured('review-123', 'admin-123', true);

      expect(result.isFeatured).toBe(true);
    });

    it('throws BadRequestException when the review is not approved', async () => {
      const review = createMockReview({ status: ReviewStatus.PENDING });
      const admin = createMockUser({ id: 'admin-123', isAdmin: true });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(admin);

      await expect(
        service.setFeatured('review-123', 'admin-123', true),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException for a non-admin', async () => {
      const review = createMockReview({ status: ReviewStatus.APPROVED });
      const user = createMockUser({ id: 'user-123', isAdmin: false });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockUserService.findById.mockResolvedValue(user);

      await expect(
        service.setFeatured('review-123', 'user-123', true),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteAllForRequest', () => {
    it('deletes every review for a request and recomputes both affected ratings', async () => {
      const clientReview = createMockReview({
        id: 'review-1',
        direction: ReviewDirection.CLIENT_TO_PROVIDER,
        serviceProviderId: 'service-provider-123',
      });
      const providerReview = createMockReview({
        id: 'review-2',
        direction: ReviewDirection.PROVIDER_TO_CLIENT,
        revieweeUserId: 'client-1',
        serviceProviderId: null,
      });

      mockReviewRepository.findAllByRequestId.mockResolvedValue([
        clientReview,
        providerReview,
      ]);
      mockReviewRepository.findApprovedByServiceProviderId.mockResolvedValue(
        [],
      );
      mockReviewRepository.findApprovedByRevieweeUserId.mockResolvedValue([]);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(
        createMockProfessional(),
      );

      await service.deleteAllForRequest('request-123');

      expect(mockReviewRepository.delete).toHaveBeenCalledWith('review-1');
      expect(mockReviewRepository.delete).toHaveBeenCalledWith('review-2');
      expect(mockProfessionalService.updateRating).toHaveBeenCalled();
      expect(mockUserService.updateClientRating).toHaveBeenCalledWith(
        'client-1',
        0,
        0,
      );
    });
  });

  describe('hasReviewForRequestAndDirection', () => {
    it('returns true when a review exists for that direction', async () => {
      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(
        createMockReview(),
      );

      const result = await service.hasReviewForRequestAndDirection(
        'request-123',
        ReviewDirection.CLIENT_TO_PROVIDER,
      );

      expect(result).toBe(true);
    });

    it('returns false when no review exists for that direction', async () => {
      mockReviewRepository.findByRequestIdAndDirection.mockResolvedValue(null);

      const result = await service.hasReviewForRequestAndDirection(
        'request-123',
        ReviewDirection.PROVIDER_TO_CLIENT,
      );

      expect(result).toBe(false);
    });
  });
});
