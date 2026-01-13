import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { RequestInterestService } from './request-interest.service';
import { REQUEST_INTEREST_REPOSITORY } from '../../domain/repositories/request-interest.repository';
import { REQUEST_REPOSITORY } from '../../domain/repositories/request.repository';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import {
  createMockProfessional,
  createMockRequest,
} from '../../../__mocks__/test-utils';
import { RequestStatus } from '@prisma/client';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';

const createMockInterest = (
  overrides?: Partial<RequestInterestEntity>,
): RequestInterestEntity => {
  return new RequestInterestEntity(
    overrides?.id || 'interest-123',
    overrides?.requestId || 'request-123',
    overrides?.professionalId || 'prof-123',
    overrides?.message || 'Interested in this job',
    overrides?.createdAt || new Date(),
  );
};

// Extended context that includes both serviceProviderId and professionalId
interface InterestAuthContext {
  userId: string;
  serviceProviderId?: string | null;
  professionalId?: string | null;
  isAdmin?: boolean;
}

// Helper to create auth context
const createAuthContext = (
  userId: string,
  serviceProviderId?: string | null,
  professionalId?: string | null,
  isAdmin = false,
): InterestAuthContext => ({
  userId,
  serviceProviderId: serviceProviderId ?? null,
  professionalId: professionalId ?? null,
  isAdmin,
});

describe('RequestInterestService', () => {
  let service: RequestInterestService;
  let mockRequestInterestRepository: any;
  let mockRequestRepository: any;
  let mockProfessionalService: any;
  let mockEventBus: any;

  beforeEach(async () => {
    mockRequestInterestRepository = {
      add: jest.fn(),
      findByRequestAndProfessional: jest.fn(),
      findByRequestId: jest.fn(),
      remove: jest.fn(),
      removeAllByRequestId: jest.fn(),
    };

    mockRequestRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    mockProfessionalService = {
      findByUserId: jest.fn(),
      getByIdOrFail: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestInterestService,
        {
          provide: REQUEST_INTEREST_REPOSITORY,
          useValue: mockRequestInterestRepository,
        },
        { provide: REQUEST_REPOSITORY, useValue: mockRequestRepository },
        { provide: EVENT_BUS, useValue: mockEventBus },
        { provide: ProfessionalService, useValue: mockProfessionalService },
      ],
    }).compile();

    service = module.get<RequestInterestService>(RequestInterestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildAuthContext', () => {
    it('should build context with professional ID', async () => {
      const professional = createMockProfessional({ id: 'prof-123' });
      mockProfessionalService.findByUserId.mockResolvedValue(professional);

      const ctx = await service.buildAuthContext('user-123', false);

      expect(ctx).toEqual({
        userId: 'user-123',
        serviceProviderId: 'service-provider-123',
        professionalId: 'prof-123',
        isAdmin: false,
      });
    });

    it('should build context without professional ID if none', async () => {
      mockProfessionalService.findByUserId.mockRejectedValue(
        new NotFoundException(),
      );

      const ctx = await service.buildAuthContext('user-123', false);

      expect(ctx).toEqual({
        userId: 'user-123',
        serviceProviderId: null,
        professionalId: null,
        isAdmin: false,
      });
    });
  });

  describe('expressInterest', () => {
    const dto = { message: 'I am interested' };

    it('should express interest successfully', async () => {
      const professional = createMockProfessional({
        id: 'prof-123',
        trades: [
          {
            id: 'trade-1',
            name: 'Trade 1',
            category: null,
            description: null,
            isPrimary: true,
          },
        ],
      });
      // Mock data returned by findByUserId (includes user info and tradeIds getter)
      const professionalWithUser = {
        ...professional,
        tradeIds: ['trade-1'], // Mimic the getter
        user: { firstName: 'John', lastName: 'Doe' },
      };
      const request = createMockRequest({
        isPublic: true,
        status: RequestStatus.PENDING,
        tradeId: 'trade-1',
        providerId: null,
      });
      const interest = createMockInterest();

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        null,
      );
      mockProfessionalService.findByUserId.mockResolvedValue(professionalWithUser);
      mockRequestInterestRepository.add.mockResolvedValue(interest);

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      const result = await service.expressInterest('request-123', ctx, dto);

      expect(result).toEqual(interest);
      expect(mockRequestInterestRepository.add).toHaveBeenCalledWith({
        requestId: 'request-123',
        professionalId: 'prof-123',
        message: 'I am interested',
      });
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'requests.request_interest.expressed',
          payload: expect.objectContaining({
            requestId: 'request-123',
            clientId: request.clientId,
            professionalId: 'prof-123',
          }),
        }),
      );
    });

    it('should throw ForbiddenException if user is not a professional', async () => {
      const ctx = createAuthContext('user-123', null, null);

      await expect(
        service.expressInterest('request-123', ctx, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      await expect(
        service.expressInterest('request-123', ctx, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if request is not public', async () => {
      const request = createMockRequest({
        isPublic: false,
        status: RequestStatus.PENDING,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      await expect(
        service.expressInterest('request-123', ctx, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if request is not pending', async () => {
      const request = createMockRequest({
        isPublic: true,
        status: RequestStatus.ACCEPTED,
        providerId: null,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      await expect(
        service.expressInterest('request-123', ctx, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already expressed interest', async () => {
      const request = createMockRequest({
        isPublic: true,
        status: RequestStatus.PENDING,
        providerId: null,
      });
      const existingInterest = createMockInterest();

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        existingInterest,
      );

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      await expect(
        service.expressInterest('request-123', ctx, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if professional does not have matching trade', async () => {
      const professional = createMockProfessional({
        id: 'prof-123',
        trades: [
          {
            id: 'trade-other',
            name: 'Other Trade',
            category: null,
            description: null,
            isPrimary: true,
          },
        ],
      });
      const request = createMockRequest({
        isPublic: true,
        status: RequestStatus.PENDING,
        tradeId: 'trade-1',
        providerId: null,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        null,
      );
      mockProfessionalService.findByUserId.mockResolvedValue(professional);

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      await expect(
        service.expressInterest('request-123', ctx, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow interest without trade requirement', async () => {
      const professional = createMockProfessional({
        id: 'prof-123',
        trades: [],
      });
      const professionalWithUser = {
        ...professional,
        user: { firstName: 'John', lastName: 'Doe' },
      };
      const request = createMockRequest({
        isPublic: true,
        status: RequestStatus.PENDING,
        tradeId: null,
        providerId: null,
      });
      const interest = createMockInterest();

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        null,
      );
      mockProfessionalService.findByUserId.mockResolvedValue(professionalWithUser);
      mockRequestInterestRepository.add.mockResolvedValue(interest);

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      const result = await service.expressInterest('request-123', ctx, dto);
      expect(result).toEqual(interest);
    });
  });

  describe('removeInterest', () => {
    it('should remove interest successfully', async () => {
      const interest = createMockInterest();

      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        interest,
      );
      mockRequestInterestRepository.remove.mockResolvedValue(undefined);

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      await service.removeInterest('request-123', ctx);

      expect(mockRequestInterestRepository.remove).toHaveBeenCalledWith(
        'request-123',
        'prof-123',
      );
    });

    it('should throw ForbiddenException if user is not a professional', async () => {
      const ctx = createAuthContext('user-123', null, null);

      await expect(service.removeInterest('request-123', ctx)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if interest not found', async () => {
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        null,
      );

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      await expect(service.removeInterest('request-123', ctx)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getInterestedProfessionals', () => {
    it('should return interested professionals for request owner', async () => {
      const request = createMockRequest({ clientId: 'user-123' });
      const interests = [
        createMockInterest(),
        createMockInterest({ id: 'interest-456' }),
      ];

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestId.mockResolvedValue(
        interests,
      );

      const ctx = createAuthContext('user-123', null, null);
      const result = await service.getInterestedProfessionals(
        'request-123',
        ctx,
      );

      expect(result).toHaveLength(2);
    });

    it('should allow admin to view interested professionals', async () => {
      const request = createMockRequest({ clientId: 'other-user' });
      const interests = [createMockInterest()];

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestId.mockResolvedValue(
        interests,
      );

      const ctx = createAuthContext('admin-user', null, null, true);
      const result = await service.getInterestedProfessionals(
        'request-123',
        ctx,
      );

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

      const ctx = createAuthContext('user-123', null, null);
      await expect(
        service.getInterestedProfessionals('request-123', ctx),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not request owner', async () => {
      const request = createMockRequest({ clientId: 'other-user' });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('user-123', null, null);
      await expect(
        service.getInterestedProfessionals('request-123', ctx),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('hasExpressedInterest', () => {
    it('should return true if interest exists', async () => {
      const interest = createMockInterest();

      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        interest,
      );

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      const result = await service.hasExpressedInterest('request-123', ctx);

      expect(result).toBe(true);
    });

    it('should return false if no interest exists', async () => {
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        null,
      );

      const ctx = createAuthContext('user-123', 'service-provider-123', 'prof-123');
      const result = await service.hasExpressedInterest('request-123', ctx);

      expect(result).toBe(false);
    });

    it('should return false if user is not a professional', async () => {
      const ctx = createAuthContext('user-123', null, null);
      const result = await service.hasExpressedInterest('request-123', ctx);

      expect(result).toBe(false);
    });
  });

  describe('assignProfessional', () => {
    it('should assign professional successfully', async () => {
      const request = createMockRequest({
        clientId: 'user-123',
        isPublic: true,
        status: RequestStatus.PENDING,
      });
      const professional = createMockProfessional({ id: 'prof-123' });
      const interest = createMockInterest();
      const updatedRequest = createMockRequest({
        clientId: 'user-123',
        providerId: 'service-provider-123',
        status: RequestStatus.ACCEPTED,
        isPublic: false,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        interest,
      );
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockRequestRepository.save.mockResolvedValue(updatedRequest);
      mockRequestInterestRepository.removeAllByRequestId.mockResolvedValue(
        undefined,
      );

      const ctx = createAuthContext('user-123', null, null);
      const result = await service.assignProfessional(
        'request-123',
        ctx,
        'prof-123',
      );

      expect(result.providerId).toBe('service-provider-123');
      expect(result.status).toBe(RequestStatus.ACCEPTED);
      expect(
        mockRequestInterestRepository.removeAllByRequestId,
      ).toHaveBeenCalledWith('request-123');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'requests.request.professional_assigned',
          payload: expect.objectContaining({
            requestId: updatedRequest.id,
            clientId: updatedRequest.clientId,
            professionalId: 'prof-123',
          }),
        }),
      );
    });

    it('should allow admin to assign professional', async () => {
      const request = createMockRequest({
        clientId: 'other-user',
        isPublic: true,
        status: RequestStatus.PENDING,
      });
      const professional = createMockProfessional({ id: 'prof-123' });
      const interest = createMockInterest();
      const updatedRequest = createMockRequest({
        providerId: 'service-provider-123',
        status: RequestStatus.ACCEPTED,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        interest,
      );
      mockProfessionalService.getByIdOrFail.mockResolvedValue(professional);
      mockRequestRepository.save.mockResolvedValue(updatedRequest);
      mockRequestInterestRepository.removeAllByRequestId.mockResolvedValue(
        undefined,
      );

      const ctx = createAuthContext('admin-user', null, null, true);
      const result = await service.assignProfessional(
        'request-123',
        ctx,
        'prof-123',
      );

      expect(result.providerId).toBe('service-provider-123');
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

      const ctx = createAuthContext('user-123', null, null);
      await expect(
        service.assignProfessional('request-123', ctx, 'prof-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not request owner', async () => {
      const request = createMockRequest({ clientId: 'other-user' });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('user-123', null, null);
      await expect(
        service.assignProfessional('request-123', ctx, 'prof-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if request is not public', async () => {
      const request = createMockRequest({
        clientId: 'user-123',
        isPublic: false,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('user-123', null, null);
      await expect(
        service.assignProfessional('request-123', ctx, 'prof-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if request is not pending', async () => {
      const request = createMockRequest({
        clientId: 'user-123',
        isPublic: true,
        status: RequestStatus.DONE,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      const ctx = createAuthContext('user-123', null, null);
      await expect(
        service.assignProfessional('request-123', ctx, 'prof-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if professional has not expressed interest', async () => {
      const request = createMockRequest({
        clientId: 'user-123',
        isPublic: true,
        status: RequestStatus.PENDING,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(
        null,
      );

      const ctx = createAuthContext('user-123', null, null);
      await expect(
        service.assignProfessional('request-123', ctx, 'prof-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
