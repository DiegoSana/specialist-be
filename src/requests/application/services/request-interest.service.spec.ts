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
import { CompanyService } from '../../../profiles/application/services/company.service';
import {
  createMockProfessional,
  createMockRequest,
} from '../../../__mocks__/test-utils';
import { RequestStatus, ProviderType } from '@prisma/client';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';

const createMockInterest = (
  overrides?: Partial<{
    id: string;
    requestId: string;
    serviceProviderId: string;
    message: string | null;
    createdAt: Date;
  }>,
): RequestInterestEntity => {
  return new RequestInterestEntity(
    overrides?.id || 'interest-123',
    overrides?.requestId || 'request-123',
    overrides?.serviceProviderId || 'sp-123',
    overrides?.message || 'Interested in this job',
    overrides?.createdAt || new Date(),
  );
};

// Auth context for interest operations
interface InterestAuthContext {
  userId: string;
  serviceProviderId?: string | null;
  providerType?: ProviderType | null;
  providerName?: string | null;
  providerTradeIds?: string[];
  isAdmin?: boolean;
}

// Helper to create auth context
const createAuthContext = (
  userId: string,
  serviceProviderId?: string | null,
  providerType?: ProviderType | null,
  providerTradeIds?: string[],
  isAdmin = false,
): InterestAuthContext => ({
  userId,
  serviceProviderId: serviceProviderId ?? null,
  providerType: providerType ?? null,
  providerName: 'Test Provider',
  providerTradeIds: providerTradeIds ?? [],
  isAdmin,
});

describe('RequestInterestService', () => {
  let service: RequestInterestService;
  let mockRequestInterestRepository: any;
  let mockRequestRepository: any;
  let mockProfessionalService: any;
  let mockCompanyService: any;
  let mockEventBus: any;

  beforeEach(async () => {
    mockRequestInterestRepository = {
      add: jest.fn(),
      findByRequestAndProvider: jest.fn(),
      findByRequestId: jest.fn(),
      findByServiceProviderId: jest.fn(),
      remove: jest.fn(),
      removeAllByRequestId: jest.fn(),
    };

    mockRequestRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    mockProfessionalService = {
      findByUserId: jest.fn(),
      findByServiceProviderId: jest.fn(),
      getByIdOrFail: jest.fn(),
    };

    mockCompanyService = {
      findByUserId: jest.fn(),
      findByServiceProviderId: jest.fn(),
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
        { provide: CompanyService, useValue: mockCompanyService },
      ],
    }).compile();

    service = module.get<RequestInterestService>(RequestInterestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildAuthContext', () => {
    it('should return context with professional serviceProviderId', async () => {
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'user-123',
        serviceProviderId: 'sp-123',
      });
      mockProfessionalService.findByUserId.mockResolvedValue(professional);

      const ctx = await service.buildAuthContext('user-123', false);

      expect(ctx.userId).toBe('user-123');
      expect(ctx.serviceProviderId).toBe('sp-123');
      expect(ctx.providerType).toBe(ProviderType.PROFESSIONAL);
      expect(ctx.isAdmin).toBe(false);
    });

    it('should return context with company serviceProviderId if no professional', async () => {
      mockProfessionalService.findByUserId.mockResolvedValue(null);
      mockCompanyService.findByUserId.mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        serviceProviderId: 'sp-456',
        companyName: 'Test Company',
        tradeIds: ['trade-1'],
      });

      const ctx = await service.buildAuthContext('user-123', false);

      expect(ctx.userId).toBe('user-123');
      expect(ctx.serviceProviderId).toBe('sp-456');
      expect(ctx.providerType).toBe(ProviderType.COMPANY);
    });

    it('should return null serviceProviderId if no provider profile', async () => {
      mockProfessionalService.findByUserId.mockResolvedValue(null);
      mockCompanyService.findByUserId.mockRejectedValue(new NotFoundException());

      const ctx = await service.buildAuthContext('user-123', false);

      expect(ctx.userId).toBe('user-123');
      expect(ctx.serviceProviderId).toBeNull();
    });

    it('should include isAdmin flag', async () => {
      mockProfessionalService.findByUserId.mockResolvedValue(null);
      mockCompanyService.findByUserId.mockResolvedValue(null);

      const ctx = await service.buildAuthContext('admin-123', true);

      expect(ctx.isAdmin).toBe(true);
    });
  });

  describe('expressInterest', () => {
    const publicRequest = createMockRequest({
      id: 'request-123',
      clientId: 'client-123',
      providerId: null, // No provider assigned yet
      isPublic: true,
      status: RequestStatus.PENDING,
      tradeId: 'trade-1',
    });

    it('should express interest successfully for provider', async () => {
      const ctx = createAuthContext('user-123', 'sp-123', ProviderType.PROFESSIONAL, ['trade-1']);
      mockRequestRepository.findById.mockResolvedValue(publicRequest);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(null);
      mockRequestInterestRepository.add.mockResolvedValue(createMockInterest());

      const result = await service.expressInterest('request-123', ctx, { message: 'Interested' });

      expect(result).toBeDefined();
      expect(mockRequestInterestRepository.add).toHaveBeenCalledWith({
        requestId: 'request-123',
        serviceProviderId: 'sp-123',
        message: 'Interested',
      });
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user has no provider profile', async () => {
      const ctx = createAuthContext('user-123', null, null);

      await expect(
        service.expressInterest('request-123', ctx, { message: 'Interested' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if request not found', async () => {
      const ctx = createAuthContext('user-123', 'sp-123', ProviderType.PROFESSIONAL);
      mockRequestRepository.findById.mockResolvedValue(null);

      await expect(
        service.expressInterest('request-123', ctx, { message: 'Interested' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already expressed interest', async () => {
      const ctx = createAuthContext('user-123', 'sp-123', ProviderType.PROFESSIONAL, ['trade-1']);
      mockRequestRepository.findById.mockResolvedValue(publicRequest);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(createMockInterest());

      await expect(
        service.expressInterest('request-123', ctx, { message: 'Interested' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if request is not public', async () => {
      const ctx = createAuthContext('user-123', 'sp-123', ProviderType.PROFESSIONAL);
      const privateRequest = createMockRequest({ isPublic: false, providerId: null });
      mockRequestRepository.findById.mockResolvedValue(privateRequest);

      await expect(
        service.expressInterest('request-123', ctx, { message: 'Interested' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if provider does not have required trade', async () => {
      const ctx = createAuthContext('user-123', 'sp-123', ProviderType.PROFESSIONAL, ['wrong-trade']);
      mockRequestRepository.findById.mockResolvedValue(publicRequest);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(null);

      await expect(
        service.expressInterest('request-123', ctx, { message: 'Interested' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeInterest', () => {
    it('should remove interest successfully', async () => {
      const ctx = createAuthContext('user-123', 'sp-123', ProviderType.PROFESSIONAL);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(createMockInterest());

      await service.removeInterest('request-123', ctx);

      expect(mockRequestInterestRepository.remove).toHaveBeenCalledWith('request-123', 'sp-123');
    });

    it('should throw ForbiddenException if user has no provider profile', async () => {
      const ctx = createAuthContext('user-123', null, null);

      await expect(service.removeInterest('request-123', ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if interest not found', async () => {
      const ctx = createAuthContext('user-123', 'sp-123', ProviderType.PROFESSIONAL);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(null);

      await expect(service.removeInterest('request-123', ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInterestedProviders', () => {
    it('should return interests for request owner', async () => {
      const ctx = createAuthContext('client-123', null, null);
      const request = createMockRequest({ id: 'request-123', clientId: 'client-123' });
      const interests = [createMockInterest()];
      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestId.mockResolvedValue(interests);

      const result = await service.getInterestedProviders('request-123', ctx);

      expect(result).toEqual(interests);
    });

    it('should return interests for admin', async () => {
      const ctx = createAuthContext('admin-123', null, null, [], true);
      const request = createMockRequest({ id: 'request-123', clientId: 'other-user' });
      const interests = [createMockInterest()];
      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestId.mockResolvedValue(interests);

      const result = await service.getInterestedProviders('request-123', ctx);

      expect(result).toEqual(interests);
    });

    it('should throw NotFoundException if request not found', async () => {
      const ctx = createAuthContext('user-123', null, null);
      mockRequestRepository.findById.mockResolvedValue(null);

      await expect(service.getInterestedProviders('request-123', ctx)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not owner or admin', async () => {
      const ctx = createAuthContext('other-user', null, null);
      const request = createMockRequest({ id: 'request-123', clientId: 'client-123' });
      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.getInterestedProviders('request-123', ctx)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('hasExpressedInterest', () => {
    it('should return true if interest exists', async () => {
      const ctx = createAuthContext('user-123', 'sp-123', ProviderType.PROFESSIONAL);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(createMockInterest());

      const result = await service.hasExpressedInterest('request-123', ctx);

      expect(result).toBe(true);
    });

    it('should return false if no interest', async () => {
      const ctx = createAuthContext('user-123', 'sp-123', ProviderType.PROFESSIONAL);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(null);

      const result = await service.hasExpressedInterest('request-123', ctx);

      expect(result).toBe(false);
    });

    it('should return false if no provider profile', async () => {
      const ctx = createAuthContext('user-123', null, null);

      const result = await service.hasExpressedInterest('request-123', ctx);

      expect(result).toBe(false);
    });
  });

  describe('assignProvider', () => {
    const publicRequest = createMockRequest({
      id: 'request-123',
      clientId: 'client-123',
      isPublic: true,
      status: RequestStatus.PENDING,
    });

    it('should assign provider successfully', async () => {
      const ctx = createAuthContext('client-123', null, null);
      const interest = createMockInterest({ serviceProviderId: 'sp-123' });
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'provider-user',
        serviceProviderId: 'sp-123',
      });
      const updatedRequest = createMockRequest({
        ...publicRequest,
        providerId: 'sp-123',
        status: RequestStatus.ACCEPTED,
      });

      mockRequestRepository.findById.mockResolvedValue(publicRequest);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(interest);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(professional);
      mockRequestRepository.save.mockResolvedValue(updatedRequest);

      const result = await service.assignProvider('request-123', ctx, 'sp-123');

      expect(result.providerId).toBe('sp-123');
      expect(result.status).toBe(RequestStatus.ACCEPTED);
      expect(mockRequestInterestRepository.removeAllByRequestId).toHaveBeenCalledWith('request-123');
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw NotFoundException if request not found', async () => {
      const ctx = createAuthContext('client-123', null, null);
      mockRequestRepository.findById.mockResolvedValue(null);

      await expect(service.assignProvider('request-123', ctx, 'sp-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      const ctx = createAuthContext('other-user', null, null);
      mockRequestRepository.findById.mockResolvedValue(publicRequest);

      await expect(service.assignProvider('request-123', ctx, 'sp-123')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if provider has not expressed interest', async () => {
      const ctx = createAuthContext('client-123', null, null);
      mockRequestRepository.findById.mockResolvedValue(publicRequest);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(null);

      await expect(service.assignProvider('request-123', ctx, 'sp-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if request is not public', async () => {
      const ctx = createAuthContext('client-123', null, null);
      const privateRequest = createMockRequest({ isPublic: false, clientId: 'client-123' });
      mockRequestRepository.findById.mockResolvedValue(privateRequest);

      await expect(service.assignProvider('request-123', ctx, 'sp-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if request is not pending', async () => {
      const ctx = createAuthContext('client-123', null, null);
      const acceptedRequest = createMockRequest({
        ...publicRequest,
        status: RequestStatus.ACCEPTED,
      });
      mockRequestRepository.findById.mockResolvedValue(acceptedRequest);

      await expect(service.assignProvider('request-123', ctx, 'sp-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow admin to assign', async () => {
      const ctx = createAuthContext('admin-123', null, null, [], true);
      const interest = createMockInterest({ serviceProviderId: 'sp-123' });
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'provider-user',
        serviceProviderId: 'sp-123',
      });
      const updatedRequest = createMockRequest({
        ...publicRequest,
        providerId: 'sp-123',
        status: RequestStatus.ACCEPTED,
      });

      mockRequestRepository.findById.mockResolvedValue(publicRequest);
      mockRequestInterestRepository.findByRequestAndProvider.mockResolvedValue(interest);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(professional);
      mockRequestRepository.save.mockResolvedValue(updatedRequest);

      const result = await service.assignProvider('request-123', ctx, 'sp-123');

      expect(result.providerId).toBe('sp-123');
    });
  });

});
