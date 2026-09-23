import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UserService } from '../../identity/application/services/user.service';
import { ProfessionalService } from '../../profiles/application/services/professional.service';
import { CompanyService } from '../../profiles/application/services/company.service';
import { CompanyEntity } from '../../profiles/domain/entities/company.entity';
import { RequestService } from '../../requests/application/services/request.service';
import { RequestInterestService } from '../../requests/application/services/request-interest.service';
import { RequestInterestEntity } from '../../requests/domain/entities/request-interest.entity';
import { ReviewService } from '../../reputation/application/services/review.service';
import { ReviewEntity } from '../../reputation/domain/entities/review.entity';
import { ReviewStatus } from '../../reputation/domain/value-objects/review-status';
import {
  createMockUser,
  createMockProfessional,
  createMockRequest,
} from '../../__mocks__/test-utils';
import { UserStatus, ProfessionalStatus, RequestStatus } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let mockUserService: any;
  let mockProfessionalService: any;
  let mockCompanyService: any;
  let mockRequestService: any;
  let mockRequestInterestService: any;
  let mockReviewService: any;

  beforeEach(async () => {
    mockUserService = {
      findById: jest.fn(),
      findByIdOrFail: jest.fn(),
      update: jest.fn(),
      findByIdForUser: jest.fn(),
      updateStatusForUser: jest.fn(),
      updateWhatsAppOptOutForUser: jest.fn(),
      getAllUsersForAdmin: jest.fn(),
      getUserStats: jest.fn(),
    };

    mockProfessionalService = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      updateStatus: jest.fn(),
      getAllProfessionalsForAdmin: jest.fn(),
      getProfessionalByIdForAdmin: jest.fn(),
      getProfessionalStats: jest.fn(),
    };

    mockCompanyService = {
      findByUserId: jest.fn(),
      getAllCompaniesForAdmin: jest.fn(),
      getCompanyByIdForAdmin: jest.fn(),
      updateStatus: jest.fn(),
      getCompanyStats: jest.fn(),
    };

    mockRequestService = {
      getAllRequestsForAdmin: jest.fn(),
      getRequestStats: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockRequestInterestService = {
      getInterestedProviders: jest.fn(),
    };

    mockReviewService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UserService, useValue: mockUserService },
        { provide: ProfessionalService, useValue: mockProfessionalService },
        { provide: CompanyService, useValue: mockCompanyService },
        { provide: RequestService, useValue: mockRequestService },
        {
          provide: RequestInterestService,
          useValue: mockRequestInterestService,
        },
        { provide: ReviewService, useValue: mockReviewService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return paginated users', async () => {
      const users = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          firstName: 'User',
          lastName: 'One',
          status: 'ACTIVE',
          createdAt: new Date(),
          client: null,
          professional: null,
        },
        {
          id: 'user-2',
          email: 'user2@test.com',
          firstName: 'User',
          lastName: 'Two',
          status: 'ACTIVE',
          createdAt: new Date(),
          client: { id: 'client-1' },
          professional: null,
        },
      ];

      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: users,
        meta: {
          total: 15,
          page: 1,
          limit: 10,
          totalPages: 2,
        },
      });

      const result = await service.getAllUsers(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(15);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(2);
      expect(mockUserService.getAllUsersForAdmin).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
      );
    });

    it('should handle empty results', async () => {
      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });

      const result = await service.getAllUsers(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should apply pagination correctly', async () => {
      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 25,
          page: 3,
          limit: 5,
          totalPages: 5,
        },
      });

      await service.getAllUsers(3, 5);

      expect(mockUserService.getAllUsersForAdmin).toHaveBeenCalledWith(
        3,
        5,
        undefined,
        undefined,
      );
    });

    it('should use default pagination values', async () => {
      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });

      await service.getAllUsers();

      expect(mockUserService.getAllUsersForAdmin).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
      );
    });

    it('should pass the search term through to the user service', async () => {
      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await service.getAllUsers(1, 10, 'jane');

      expect(mockUserService.getAllUsersForAdmin).toHaveBeenCalledWith(
        1,
        10,
        'jane',
        undefined,
      );
    });

    it('should pass the type filter through to the user service', async () => {
      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await service.getAllUsers(1, 10, undefined, 'CLIENT');

      expect(mockUserService.getAllUsersForAdmin).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        'CLIENT',
      );
    });
  });

  describe('getUserById', () => {
    const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });

    beforeEach(() => {
      // Default: user has neither a professional nor a company profile.
      mockProfessionalService.findByUserId.mockRejectedValue(
        new NotFoundException('Professional profile not found'),
      );
      mockCompanyService.findByUserId.mockRejectedValue(
        new NotFoundException('Company profile not found'),
      );
    });

    it('should return user with professionalId/companyId null when neither profile exists', async () => {
      const user = createMockUser();
      mockUserService.findByIdForUser.mockResolvedValue(user);

      const result = await service.getUserById('user-123', adminUser);

      expect(result).toEqual({
        ...user,
        professionalId: null,
        companyId: null,
      });
      expect(mockUserService.findByIdForUser).toHaveBeenCalledWith(
        'user-123',
        adminUser,
      );
      expect(mockProfessionalService.findByUserId).toHaveBeenCalledWith(
        'user-123',
      );
      expect(mockCompanyService.findByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should populate professionalId and leave companyId null when the user has a professional profile', async () => {
      const user = createMockUser();
      const professional = createMockProfessional({ id: 'professional-1' });
      mockUserService.findByIdForUser.mockResolvedValue(user);
      mockProfessionalService.findByUserId.mockResolvedValue(professional);

      const result = await service.getUserById('user-123', adminUser);

      expect(result.professionalId).toBe('professional-1');
      expect(result.companyId).toBeNull();
    });

    it('should populate companyId and leave professionalId null when the user has a company profile', async () => {
      const user = createMockUser();
      const company = { id: 'company-1' } as CompanyEntity;
      mockUserService.findByIdForUser.mockResolvedValue(user);
      mockCompanyService.findByUserId.mockResolvedValue(company);

      const result = await service.getUserById('user-123', adminUser);

      expect(result.professionalId).toBeNull();
      expect(result.companyId).toBe('company-1');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.findByIdForUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.getUserById('non-existent', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });

    it('should update user status successfully', async () => {
      const updatedUser = createMockUser({ status: UserStatus.SUSPENDED });
      mockUserService.updateStatusForUser.mockResolvedValue(updatedUser);

      const result = await service.updateUserStatus(
        'user-123',
        { status: UserStatus.SUSPENDED },
        adminUser,
      );

      expect(result.status).toBe(UserStatus.SUSPENDED);
      expect(mockUserService.updateStatusForUser).toHaveBeenCalledWith(
        'user-123',
        adminUser,
        UserStatus.SUSPENDED,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.updateStatusForUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.updateUserStatus(
          'non-existent',
          { status: UserStatus.SUSPENDED },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserWhatsAppOptOut', () => {
    const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });

    it('should update the WhatsApp opt-out flag successfully', async () => {
      const updatedUser = createMockUser({ whatsappOptedOut: true });
      mockUserService.updateWhatsAppOptOutForUser.mockResolvedValue(
        updatedUser,
      );

      const result = await service.updateUserWhatsAppOptOut(
        'user-123',
        { whatsappOptedOut: true },
        adminUser,
      );

      expect(result.whatsappOptedOut).toBe(true);
      expect(mockUserService.updateWhatsAppOptOutForUser).toHaveBeenCalledWith(
        'user-123',
        adminUser,
        true,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.updateWhatsAppOptOutForUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.updateUserWhatsAppOptOut(
          'non-existent',
          { whatsappOptedOut: true },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllProfessionals', () => {
    it('should return paginated professionals', async () => {
      const professionals = [
        {
          id: 'prof-1',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'pro1@test.com',
            firstName: 'Pro',
            lastName: 'One',
          },
          trades: [{ trade: { id: 'trade-1', name: 'Electricista' } }],
          createdAt: new Date(),
        },
      ];

      mockProfessionalService.getAllProfessionalsForAdmin.mockResolvedValue({
        data: professionals,
        meta: {
          total: 5,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      const result = await service.getAllProfessionals(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(5);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
      expect(
        mockProfessionalService.getAllProfessionalsForAdmin,
      ).toHaveBeenCalledWith(1, 10);
    });

    it('should handle empty results', async () => {
      mockProfessionalService.getAllProfessionalsForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });

      const result = await service.getAllProfessionals(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should apply pagination correctly', async () => {
      mockProfessionalService.getAllProfessionalsForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 30,
          page: 2,
          limit: 15,
          totalPages: 2,
        },
      });

      await service.getAllProfessionals(2, 15);

      expect(
        mockProfessionalService.getAllProfessionalsForAdmin,
      ).toHaveBeenCalledWith(2, 15);
    });
  });

  describe('updateProfessionalStatus', () => {
    const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });

    it('should update professional status successfully', async () => {
      const updatedProfessional = createMockProfessional({
        status: ProfessionalStatus.VERIFIED,
      });
      mockProfessionalService.updateStatus.mockResolvedValue(
        updatedProfessional,
      );

      const result = await service.updateProfessionalStatus(
        'prof-123',
        { status: ProfessionalStatus.VERIFIED },
        adminUser,
      );

      expect(result.status).toBe(ProfessionalStatus.VERIFIED);
      expect(mockProfessionalService.updateStatus).toHaveBeenCalledWith(
        'prof-123',
        ProfessionalStatus.VERIFIED,
        adminUser,
      );
    });

    it('should throw NotFoundException when professional not found', async () => {
      mockProfessionalService.updateStatus.mockRejectedValue(
        new NotFoundException('Professional not found'),
      );

      await expect(
        service.updateProfessionalStatus(
          'non-existent',
          { status: ProfessionalStatus.VERIFIED },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject professional', async () => {
      const rejectedProfessional = createMockProfessional({
        status: ProfessionalStatus.REJECTED,
      });
      mockProfessionalService.updateStatus.mockResolvedValue(
        rejectedProfessional,
      );

      const result = await service.updateProfessionalStatus(
        'prof-123',
        { status: ProfessionalStatus.REJECTED },
        adminUser,
      );

      expect(result.status).toBe(ProfessionalStatus.REJECTED);
    });
  });

  describe('getRequestByIdForAdmin', () => {
    const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });

    it('should return full request detail with resolved provider and interested providers', async () => {
      const request = createMockRequest({
        id: 'request-123',
        title: 'Fix the sink',
        status: RequestStatus.PUBLISHED,
      });
      (request as any).client = {
        id: 'client-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        profilePictureUrl: null,
      };
      (request as any).trade = { id: 'trade-1', name: 'Plumbing' };
      (request as any).provider = {
        id: 'provider-1',
        type: 'PROFESSIONAL',
      };
      (request as any).professional = {
        userId: 'provider-user-1',
        trades: [{ id: 'trade-1', name: 'Plumbing' }],
        user: { firstName: 'John', lastName: 'Smith' },
      };
      const interest = new RequestInterestEntity(
        'interest-1',
        'request-123',
        'provider-2',
        'Interested!',
        new Date(),
      );

      mockRequestService.findById.mockResolvedValue(request);
      mockRequestInterestService.getInterestedProviders.mockResolvedValue([
        interest,
      ]);

      const result = await service.getRequestByIdForAdmin(
        'request-123',
        adminUser,
      );

      expect(mockRequestService.findById).toHaveBeenCalledWith('request-123');
      expect(
        mockRequestInterestService.getInterestedProviders,
      ).toHaveBeenCalledWith('request-123', {
        userId: 'admin-123',
        isAdmin: true,
      });
      expect(result.id).toBe('request-123');
      expect(result.client).toEqual({
        id: 'client-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        profilePictureUrl: null,
      });
      expect(result.trade).toEqual({ id: 'trade-1', name: 'Plumbing' });
      expect(result.provider).toEqual({
        id: 'provider-1',
        type: 'PROFESSIONAL',
        name: 'John Smith',
        userId: 'provider-user-1',
        trades: [{ id: 'trade-1', name: 'Plumbing' }],
      });
      expect(result.interestedProviders).toHaveLength(1);
      expect(result.interestedProviders[0].id).toBe('interest-1');
      expect(result.isPublic).toBe(request.isPublic);
      expect(result.review).toBeNull();
    });

    it('should propagate NotFoundException when the request does not exist', async () => {
      mockRequestService.findById.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(
        service.getRequestByIdForAdmin('missing', adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include the review when one exists for the request', async () => {
      const request = createMockRequest({
        id: 'request-123',
        status: RequestStatus.CLOSED,
      });
      const review = ReviewEntity.create({
        id: 'review-1',
        reviewerId: 'client-1',
        serviceProviderId: 'provider-1',
        requestId: 'request-123',
        rating: 5,
        comment: 'Great job!',
        status: ReviewStatus.APPROVED,
      });

      mockRequestService.findById.mockResolvedValue(request);
      mockRequestInterestService.getInterestedProviders.mockResolvedValue([]);
      mockReviewService.findByRequestId.mockResolvedValue(review);

      const result = await service.getRequestByIdForAdmin(
        'request-123',
        adminUser,
      );

      expect(mockReviewService.findByRequestId).toHaveBeenCalledWith(
        'request-123',
      );
      expect(result.review).toEqual({
        id: 'review-1',
        rating: 5,
        comment: 'Great job!',
        status: ReviewStatus.APPROVED,
      });
    });

    it('should return a null review when the request has no review yet', async () => {
      const request = createMockRequest({
        id: 'request-123',
        status: RequestStatus.CLOSED,
      });

      mockRequestService.findById.mockResolvedValue(request);
      mockRequestInterestService.getInterestedProviders.mockResolvedValue([]);
      mockReviewService.findByRequestId.mockResolvedValue(null);

      const result = await service.getRequestByIdForAdmin(
        'request-123',
        adminUser,
      );

      expect(result.review).toBeNull();
    });
  });

  describe('updateRequestStatus', () => {
    const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });

    it('should build a lightweight admin auth context and delegate to RequestService.updateStatus', async () => {
      const updatedRequest = createMockRequest({
        id: 'request-123',
        status: RequestStatus.CLOSED,
      });
      mockRequestService.updateStatus.mockResolvedValue(updatedRequest);

      const result = await service.updateRequestStatus(
        'request-123',
        { status: RequestStatus.CLOSED, statusReason: 'Resuelto' },
        adminUser,
      );

      expect(mockRequestService.updateStatus).toHaveBeenCalledWith(
        'request-123',
        { userId: 'admin-123', isAdmin: true },
        { status: RequestStatus.CLOSED, statusReason: 'Resuelto' },
      );
      expect(result.id).toBe('request-123');
      expect(result.status).toBe(RequestStatus.CLOSED);
    });

    it('should propagate ForbiddenException/NotFoundException from RequestService.updateStatus', async () => {
      mockRequestService.updateStatus.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(
        service.updateRequestStatus(
          'missing',
          { status: RequestStatus.CLOSED },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
