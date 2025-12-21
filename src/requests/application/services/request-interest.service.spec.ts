import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequestInterestService } from './request-interest.service';
import { REQUEST_INTEREST_REPOSITORY } from '../../domain/repositories/request-interest.repository';
import { REQUEST_REPOSITORY } from '../../domain/repositories/request.repository';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { createMockProfessional, createMockRequest } from '../../../__mocks__/test-utils';
import { RequestStatus } from '@prisma/client';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';

const createMockInterest = (overrides?: Partial<RequestInterestEntity>): RequestInterestEntity => {
  return new RequestInterestEntity(
    overrides?.id || 'interest-123',
    overrides?.requestId || 'request-123',
    overrides?.professionalId || 'prof-123',
    overrides?.message || 'Interested in this job',
    overrides?.createdAt || new Date(),
  );
};

describe('RequestInterestService', () => {
  let service: RequestInterestService;
  let mockRequestInterestRepository: any;
  let mockRequestRepository: any;
  let mockProfessionalService: any;

  beforeEach(async () => {
    mockRequestInterestRepository = {
      create: jest.fn(),
      findByRequestAndProfessional: jest.fn(),
      findByRequestId: jest.fn(),
      delete: jest.fn(),
      deleteAllByRequestId: jest.fn(),
    };

    mockRequestRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockProfessionalService = {
      findByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestInterestService,
        { provide: REQUEST_INTEREST_REPOSITORY, useValue: mockRequestInterestRepository },
        { provide: REQUEST_REPOSITORY, useValue: mockRequestRepository },
        { provide: ProfessionalService, useValue: mockProfessionalService },
      ],
    }).compile();

    service = module.get<RequestInterestService>(RequestInterestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('expressInterest', () => {
    const dto = { message: 'I am interested' };

    it('should express interest successfully', async () => {
      const professional = createMockProfessional({ 
        trades: [{ id: 'trade-1', name: 'Trade 1', category: null, description: null, isPrimary: true }] 
      });
      const request = createMockRequest({
        isPublic: true,
        status: RequestStatus.PENDING,
        tradeId: 'trade-1',
      });
      const interest = createMockInterest();

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(null);
      mockRequestInterestRepository.create.mockResolvedValue(interest);

      const result = await service.expressInterest('request-123', 'user-123', dto);

      expect(result).toEqual(interest);
      expect(mockRequestInterestRepository.create).toHaveBeenCalledWith({
        requestId: 'request-123',
        professionalId: professional.id,
        message: 'I am interested',
      });
    });

    it('should throw ForbiddenException if user is not a professional', async () => {
      mockProfessionalService.findByUserId.mockResolvedValue(null);

      await expect(service.expressInterest('request-123', 'user-123', dto))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if request not found', async () => {
      const professional = createMockProfessional();
      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestRepository.findById.mockResolvedValue(null);

      await expect(service.expressInterest('request-123', 'user-123', dto))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if request is not public', async () => {
      const professional = createMockProfessional();
      const request = createMockRequest({ isPublic: false });

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.expressInterest('request-123', 'user-123', dto))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if request is not pending', async () => {
      const professional = createMockProfessional();
      const request = createMockRequest({
        isPublic: true,
        status: RequestStatus.ACCEPTED,
      });

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.expressInterest('request-123', 'user-123', dto))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already expressed interest', async () => {
      const professional = createMockProfessional();
      const request = createMockRequest({ isPublic: true, status: RequestStatus.PENDING });
      const existingInterest = createMockInterest();

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(existingInterest);

      await expect(service.expressInterest('request-123', 'user-123', dto))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if professional does not have matching trade', async () => {
      const professional = createMockProfessional({ 
        trades: [{ id: 'trade-other', name: 'Other Trade', category: null, description: null, isPrimary: true }] 
      });
      const request = createMockRequest({
        isPublic: true,
        status: RequestStatus.PENDING,
        tradeId: 'trade-1',
      });

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(null);

      await expect(service.expressInterest('request-123', 'user-123', dto))
        .rejects.toThrow(BadRequestException);
    });

    it('should allow interest without trade requirement', async () => {
      const professional = createMockProfessional({ trades: [] });
      const request = createMockRequest({
        isPublic: true,
        status: RequestStatus.PENDING,
        tradeId: null,
      });
      const interest = createMockInterest();

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(null);
      mockRequestInterestRepository.create.mockResolvedValue(interest);

      const result = await service.expressInterest('request-123', 'user-123', dto);
      expect(result).toEqual(interest);
    });
  });

  describe('removeInterest', () => {
    it('should remove interest successfully', async () => {
      const professional = createMockProfessional();
      const interest = createMockInterest();

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(interest);
      mockRequestInterestRepository.delete.mockResolvedValue(undefined);

      await service.removeInterest('request-123', 'user-123');

      expect(mockRequestInterestRepository.delete).toHaveBeenCalledWith('request-123', professional.id);
    });

    it('should throw ForbiddenException if user is not a professional', async () => {
      mockProfessionalService.findByUserId.mockResolvedValue(null);

      await expect(service.removeInterest('request-123', 'user-123'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if interest not found', async () => {
      const professional = createMockProfessional();

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(null);

      await expect(service.removeInterest('request-123', 'user-123'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getInterestedProfessionals', () => {
    it('should return interested professionals for request owner', async () => {
      const request = createMockRequest({ clientId: 'user-123' });
      const interests = [createMockInterest(), createMockInterest({ id: 'interest-456' })];

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestId.mockResolvedValue(interests);

      const result = await service.getInterestedProfessionals('request-123', 'user-123');

      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

      await expect(service.getInterestedProfessionals('request-123', 'user-123'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not request owner', async () => {
      const request = createMockRequest({ clientId: 'other-user' });

      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.getInterestedProfessionals('request-123', 'user-123'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('hasExpressedInterest', () => {
    it('should return true if interest exists', async () => {
      const professional = createMockProfessional();
      const interest = createMockInterest();

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(interest);

      const result = await service.hasExpressedInterest('request-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false if no interest exists', async () => {
      const professional = createMockProfessional();

      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(null);

      const result = await service.hasExpressedInterest('request-123', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false if user is not a professional', async () => {
      mockProfessionalService.findByUserId.mockResolvedValue(null);

      const result = await service.hasExpressedInterest('request-123', 'user-123');

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
      const interest = createMockInterest();
      const updatedRequest = createMockRequest({
        ...request,
        professionalId: 'prof-123',
        status: RequestStatus.ACCEPTED,
        isPublic: false,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(interest);
      mockRequestRepository.update.mockResolvedValue(updatedRequest);
      mockRequestInterestRepository.deleteAllByRequestId.mockResolvedValue(undefined);

      const result = await service.assignProfessional('request-123', 'user-123', 'prof-123');

      expect(result.professionalId).toBe('prof-123');
      expect(result.status).toBe(RequestStatus.ACCEPTED);
      expect(mockRequestInterestRepository.deleteAllByRequestId).toHaveBeenCalledWith('request-123');
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

      await expect(service.assignProfessional('request-123', 'user-123', 'prof-123'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not request owner', async () => {
      const request = createMockRequest({ clientId: 'other-user' });

      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.assignProfessional('request-123', 'user-123', 'prof-123'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if request is not public', async () => {
      const request = createMockRequest({
        clientId: 'user-123',
        isPublic: false,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.assignProfessional('request-123', 'user-123', 'prof-123'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if request is not pending', async () => {
      const request = createMockRequest({
        clientId: 'user-123',
        isPublic: true,
        status: RequestStatus.DONE,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.assignProfessional('request-123', 'user-123', 'prof-123'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if professional has not expressed interest', async () => {
      const request = createMockRequest({
        clientId: 'user-123',
        isPublic: true,
        status: RequestStatus.PENDING,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestInterestRepository.findByRequestAndProfessional.mockResolvedValue(null);

      await expect(service.assignProfessional('request-123', 'user-123', 'prof-123'))
        .rejects.toThrow(BadRequestException);
    });
  });
});

