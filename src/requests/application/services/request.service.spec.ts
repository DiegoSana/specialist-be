import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { RequestService } from './request.service';
import { REQUEST_REPOSITORY } from '../../domain/repositories/request.repository';
import { REQUEST_QUERY_REPOSITORY } from '../../domain/queries/request.query-repository';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';
import { UserService } from '../../../identity/application/services/user.service';
import {
  createMockUser,
  createMockProfessional,
  createMockRequest,
} from '../../../__mocks__/test-utils';
import { RequestStatus, ProfessionalStatus } from '@prisma/client';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { RequestAuthContext } from '../../domain/entities/request.entity';

describe('RequestService', () => {
  let service: RequestService;
  let mockRequestRepository: any;
  let mockRequestQueryRepository: any;
  let mockProfessionalService: any;
  let mockCompanyService: any;
  let mockUserService: any;
  let mockEventBus: any;

  // Helper to create auth context
  const createAuthContext = (
    userId: string,
    serviceProviderId?: string | null,
    isAdmin = false,
  ): RequestAuthContext => ({
    userId,
    serviceProviderId: serviceProviderId ?? null,
    isAdmin,
  });

  beforeEach(async () => {
    mockRequestRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByClientId: jest.fn(),
      findByProviderId: jest.fn(),
      findPublicRequests: jest.fn(),
      findAvailableForProfessional: jest.fn(),
    };

    mockRequestQueryRepository = {
      getRequestStats: jest.fn(),
      findAllForAdmin: jest.fn(),
    };

    mockProfessionalService = {
      getByIdOrFail: jest.fn(),
      findByUserId: jest.fn(),
      findByServiceProviderId: jest.fn(),
    };

    mockCompanyService = {
      findByServiceProviderId: jest.fn(),
    };

    mockUserService = {
      findById: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestService,
        { provide: REQUEST_REPOSITORY, useValue: mockRequestRepository },
        { provide: REQUEST_QUERY_REPOSITORY, useValue: mockRequestQueryRepository },
        { provide: EVENT_BUS, useValue: mockEventBus },
        { provide: ProfessionalService, useValue: mockProfessionalService },
        { provide: CompanyService, useValue: mockCompanyService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<RequestService>(RequestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    describe('direct requests', () => {
      const directRequestDto = {
        isPublic: false,
        professionalId: 'prof-123', // DTO uses professionalId, service looks up ServiceProvider
        title: 'Electrical work needed',
        description: 'Need help with electrical work',
        address: 'Test Address 123',
      };

      it('should create a direct request successfully', async () => {
        const client = createMockUser({
          id: 'client-123',
          hasClientProfile: true,
        });
        const professional = createMockProfessional({
          id: 'prof-123',
          status: ProfessionalStatus.VERIFIED,
          active: true,
        });
        const newRequest = createMockRequest({
          clientId: 'client-123',
          isPublic: false,
          providerId: 'service-provider-123',
          tradeId: null,
        });

        mockUserService.findById.mockResolvedValue(client);
        mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
        mockRequestRepository.save.mockResolvedValue(newRequest);

        const result = await service.create('client-123', directRequestDto);

        expect(result).toEqual(newRequest);
        expect(mockRequestRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: 'client-123',
            isPublic: false,
            providerId: 'service-provider-123',
            status: RequestStatus.PENDING,
          }),
        );
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'requests.request.created',
            payload: expect.objectContaining({
              clientId: 'client-123',
              isPublic: false,
              professionalId: 'service-provider-123', // Event uses professionalId for backward compat
            }),
          }),
        );
      });

      it('should throw BadRequestException if user is not a client', async () => {
        const nonClient = createMockUser({ hasClientProfile: false });
        mockUserService.findById.mockResolvedValue(nonClient);

        await expect(
          service.create('user-123', directRequestDto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if professionalId is missing for direct request', async () => {
        const client = createMockUser({ hasClientProfile: true });
        mockUserService.findById.mockResolvedValue(client);

        await expect(
          service.create('client-123', {
            isPublic: false,
            title: 'Test',
            description: 'Test',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw NotFoundException if professional not found', async () => {
        const client = createMockUser({ hasClientProfile: true });
        mockUserService.findById.mockResolvedValue(client);
        mockProfessionalService.getByIdOrFail.mockRejectedValue(
          new NotFoundException('Professional not found'),
        );

        await expect(
          service.create('client-123', directRequestDto),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if professional is not active', async () => {
        const client = createMockUser({ hasClientProfile: true });
        const inactiveProfessional = createMockProfessional({
          status: ProfessionalStatus.PENDING_VERIFICATION,
          active: false,
        });
        mockUserService.findById.mockResolvedValue(client);
        mockProfessionalService.getByIdOrFail.mockResolvedValue(
          inactiveProfessional,
        );

        await expect(
          service.create('client-123', directRequestDto),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('public requests', () => {
      const publicRequestDto = {
        isPublic: true,
        tradeId: 'trade-123',
        title: 'Electrician needed',
        description: 'Looking for an electrician',
      };

      it('should create a public request successfully', async () => {
        const client = createMockUser({ hasClientProfile: true });
        const newRequest = createMockRequest({
          clientId: 'client-123',
          isPublic: true,
          providerId: null,
          tradeId: 'trade-123',
        });

        mockUserService.findById.mockResolvedValue(client);
        mockRequestRepository.save.mockResolvedValue(newRequest);

        const result = await service.create('client-123', publicRequestDto);

        expect(result).toEqual(newRequest);
        expect(mockRequestRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            isPublic: true,
            providerId: null,
            tradeId: 'trade-123',
            status: RequestStatus.PENDING,
          }),
        );
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'requests.request.created',
            payload: expect.objectContaining({
              clientId: 'client-123',
              isPublic: true,
              professionalId: null, // Event uses professionalId for backward compat
              tradeId: 'trade-123',
            }),
          }),
        );
      });

      it('should throw BadRequestException if tradeId is missing for public request', async () => {
        const client = createMockUser({ hasClientProfile: true });
        mockUserService.findById.mockResolvedValue(client);

        await expect(
          service.create('client-123', {
            isPublic: true,
            title: 'Test',
            description: 'Test',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('findById', () => {
    it('should return request when found', async () => {
      const request = createMockRequest();
      mockRequestRepository.findById.mockResolvedValue(request);

      const result = await service.findById('req-123');

      expect(result).toEqual(request);
    });

    it('should throw NotFoundException when request not found', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByIdForUser', () => {
    it('should allow client to view their own request', async () => {
      const request = createMockRequest({ clientId: 'client-123' });
      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('client-123');
      const result = await service.findByIdForUser('req-123', ctx);

      expect(result).toEqual(request);
    });

    it('should allow assigned professional to view request', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
      });
      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('prof-user', 'service-provider-123');
      const result = await service.findByIdForUser('req-123', ctx);

      expect(result).toEqual(request);
    });

    it('should allow admin to view any request', async () => {
      const request = createMockRequest({ clientId: 'client-123' });
      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('admin-user', null, true);
      const result = await service.findByIdForUser('req-123', ctx);

      expect(result).toEqual(request);
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
      });
      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('random-user');
      await expect(service.findByIdForUser('req-123', ctx)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should allow assigned professional to update ACCEPTED to IN_PROGRESS', async () => {
      const request = createMockRequest({
        providerId: 'service-provider-123',
        status: RequestStatus.ACCEPTED,
      });
      const updatedRequest = createMockRequest({
        providerId: 'service-provider-123',
        status: RequestStatus.IN_PROGRESS,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.save.mockResolvedValue(updatedRequest);

      const ctx = createAuthContext('prof-user', 'service-provider-123');
      const result = await service.updateStatus('req-123', ctx, {
        status: RequestStatus.IN_PROGRESS,
      });

      expect(result.status).toBe(RequestStatus.IN_PROGRESS);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'requests.request.status_changed',
          payload: expect.objectContaining({
            fromStatus: RequestStatus.ACCEPTED,
            toStatus: RequestStatus.IN_PROGRESS,
          }),
        }),
      );
    });

    it('should allow client to cancel request', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        status: RequestStatus.PENDING,
      });
      const cancelledRequest = createMockRequest({
        clientId: 'client-123',
        status: RequestStatus.CANCELLED,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.save.mockResolvedValue(cancelledRequest);

      const ctx = createAuthContext('client-123');
      const result = await service.updateStatus('req-123', ctx, {
        status: RequestStatus.CANCELLED,
      });

      expect(result.status).toBe(RequestStatus.CANCELLED);
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

      const ctx = createAuthContext('prof-user', 'service-provider-123');
      await expect(
        service.updateStatus('non-existent', ctx, {
          status: RequestStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not authorized', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
        status: RequestStatus.ACCEPTED,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('random-user');
      await expect(
        service.updateStatus('req-123', ctx, {
          status: RequestStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if client tries invalid status change', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        status: RequestStatus.PENDING,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('client-123');
      await expect(
        service.updateStatus('req-123', ctx, {
          status: RequestStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to change any status', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        status: RequestStatus.PENDING,
      });
      const updatedRequest = createMockRequest({
        status: RequestStatus.DONE,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.save.mockResolvedValue(updatedRequest);

      const ctx = createAuthContext('admin-user', null, true);
      const result = await service.updateStatus('req-123', ctx, {
        status: RequestStatus.DONE,
      });

      expect(result.status).toBe(RequestStatus.DONE);
    });
  });

  describe('addRequestPhoto', () => {
    it('should allow client to add photo to request', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        photos: ['existing.jpg'],
        status: RequestStatus.PENDING,
      });
      const updatedRequest = createMockRequest({
        photos: ['existing.jpg', 'http://example.com/new.jpg'],
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.save.mockResolvedValue(updatedRequest);

      const ctx = createAuthContext('client-123');
      const result = await service.addRequestPhoto(
        'req-123',
        ctx,
        'http://example.com/new.jpg',
      );

      expect(result.photos).toContain('http://example.com/new.jpg');
    });

    it('should allow assigned professional to add photo', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
        photos: [],
        status: RequestStatus.IN_PROGRESS,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.save.mockResolvedValue(request);

      const ctx = createAuthContext('prof-user', 'service-provider-123');
      await service.addRequestPhoto(
        'req-123',
        ctx,
        'http://example.com/photo.jpg',
      );

      expect(mockRequestRepository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
        status: RequestStatus.PENDING,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('random-user');
      await expect(
        service.addRequestPhoto('req-123', ctx, 'http://example.com/photo.jpg'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for cancelled requests', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        status: RequestStatus.CANCELLED,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('client-123');
      await expect(
        service.addRequestPhoto('req-123', ctx, 'http://example.com/photo.jpg'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for duplicate photo', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        photos: ['http://example.com/existing.jpg'],
        status: RequestStatus.PENDING,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('client-123');
      await expect(
        service.addRequestPhoto(
          'req-123',
          ctx,
          'http://example.com/existing.jpg',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid URL', async () => {
      const ctx = createAuthContext('client-123');
      await expect(
        service.addRequestPhoto('req-123', ctx, 'not-a-valid-url'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeRequestPhoto', () => {
    it('should allow client to remove photo from request', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        photos: ['photo1.jpg', 'photo2.jpg'],
        status: RequestStatus.PENDING,
      });
      const updatedRequest = createMockRequest({ photos: ['photo1.jpg'] });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.save.mockResolvedValue(updatedRequest);

      const ctx = createAuthContext('client-123');
      const result = await service.removeRequestPhoto(
        'req-123',
        ctx,
        'photo2.jpg',
      );

      expect(result.photos).not.toContain('photo2.jpg');
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
        status: RequestStatus.PENDING,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('random-user');
      await expect(
        service.removeRequestPhoto('req-123', ctx, 'photo.jpg'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rateClient', () => {
    it('should allow assigned professional to rate client after completion', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
        status: RequestStatus.DONE,
        clientRating: null,
      });
      const ratedRequest = createMockRequest({
        clientRating: 5,
        clientRatingComment: 'Great client!',
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.save.mockResolvedValue(ratedRequest);

      const ctx = createAuthContext('prof-user', 'service-provider-123');
      const result = await service.rateClient('req-123', ctx, 5, 'Great client!');

      expect(result.clientRating).toBe(5);
    });

    it('should throw BadRequestException if request is not done', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
        status: RequestStatus.IN_PROGRESS,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('prof-user', 'service-provider-123');
      await expect(service.rateClient('req-123', ctx, 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if already rated', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
        status: RequestStatus.DONE,
        clientRating: 4,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('prof-user', 'service-provider-123');
      await expect(service.rateClient('req-123', ctx, 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if not assigned professional', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
        status: RequestStatus.DONE,
        clientRating: null,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('other-user', 'other-prof');
      await expect(service.rateClient('req-123', ctx, 5)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for invalid rating', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        providerId: 'service-provider-123',
        status: RequestStatus.DONE,
        clientRating: null,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('prof-user', 'service-provider-123');
      await expect(service.rateClient('req-123', ctx, 6)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('buildAuthContext', () => {
    it('should build context with professional ID if user has professional profile', async () => {
      const professional = createMockProfessional({ id: 'prof-123' });
      mockProfessionalService.findByUserId.mockResolvedValue(professional);

      const ctx = await service.buildAuthContext('user-123', false);

      expect(ctx).toEqual({
        userId: 'user-123',
        serviceProviderId: 'service-provider-123',
        isAdmin: false,
      });
    });

    it('should build context without professional ID if user has no professional profile', async () => {
      mockProfessionalService.findByUserId.mockRejectedValue(
        new NotFoundException(),
      );

      const ctx = await service.buildAuthContext('user-123', false);

      expect(ctx).toEqual({
        userId: 'user-123',
        serviceProviderId: null,
        isAdmin: false,
      });
    });

    it('should build context with admin flag', async () => {
      mockProfessionalService.findByUserId.mockResolvedValue(null);

      const ctx = await service.buildAuthContext('admin-123', true);

      expect(ctx).toEqual({
        userId: 'admin-123',
        serviceProviderId: null,
        isAdmin: true,
      });
    });
  });

  describe('findByClientId', () => {
    it('should return all requests for a client', async () => {
      const requests = [createMockRequest(), createMockRequest()];
      mockRequestRepository.findByClientId.mockResolvedValue(requests);

      const result = await service.findByClientId('client-123');

      expect(result).toHaveLength(2);
      expect(mockRequestRepository.findByClientId).toHaveBeenCalledWith(
        'client-123',
      );
    });
  });


  describe('findPublicRequests', () => {
    it('should return public requests', async () => {
      const requests = [createMockRequest({ isPublic: true })];
      mockRequestRepository.findPublicRequests.mockResolvedValue(requests);

      const result = await service.findPublicRequests(['trade-1', 'trade-2']);

      expect(result).toHaveLength(1);
      expect(mockRequestRepository.findPublicRequests).toHaveBeenCalledWith([
        'trade-1',
        'trade-2',
      ]);
    });
  });
});
