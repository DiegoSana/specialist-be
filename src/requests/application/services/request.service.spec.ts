import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequestService } from './request.service';
import { REQUEST_REPOSITORY } from '../../domain/repositories/request.repository';
import { PROFESSIONAL_REPOSITORY } from '../../../profiles/domain/repositories/professional.repository';
import { USER_REPOSITORY } from '../../../identity/domain/repositories/user.repository';
import { createMockUser, createMockProfessional, createMockRequest } from '../../../__mocks__/test-utils';
import { RequestStatus, ProfessionalStatus } from '@prisma/client';

describe('RequestService', () => {
  let service: RequestService;
  let mockRequestRepository: any;
  let mockProfessionalRepository: any;
  let mockUserRepository: any;

  beforeEach(async () => {
    mockRequestRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByClientId: jest.fn(),
      findByProfessionalId: jest.fn(),
      findPublicRequests: jest.fn(),
      findAvailableForProfessional: jest.fn(),
      update: jest.fn(),
    };

    mockProfessionalRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
    };

    mockUserRepository = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestService,
        { provide: REQUEST_REPOSITORY, useValue: mockRequestRepository },
        { provide: PROFESSIONAL_REPOSITORY, useValue: mockProfessionalRepository },
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
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
        professionalId: 'prof-123',
        description: 'Need help with electrical work',
        address: 'Test Address 123',
      };

      it('should create a direct request successfully', async () => {
        const client = createMockUser({ id: 'client-123', hasClientProfile: true });
        const professional = createMockProfessional({ 
          id: 'prof-123', 
          status: ProfessionalStatus.VERIFIED,
          active: true,
        });
        const newRequest = createMockRequest({ clientId: 'client-123', isPublic: false });

        mockUserRepository.findById.mockResolvedValue(client);
        mockProfessionalRepository.findById.mockResolvedValue(professional);
        mockRequestRepository.create.mockResolvedValue(newRequest);

        const result = await service.create('client-123', directRequestDto);

        expect(result).toEqual(newRequest);
        expect(mockRequestRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: 'client-123',
            isPublic: false,
            professionalId: 'prof-123',
          }),
        );
      });

      it('should throw BadRequestException if user is not a client', async () => {
        const nonClient = createMockUser({ hasClientProfile: false });
        mockUserRepository.findById.mockResolvedValue(nonClient);

        await expect(service.create('user-123', directRequestDto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if professionalId is missing for direct request', async () => {
        const client = createMockUser({ hasClientProfile: true });
        mockUserRepository.findById.mockResolvedValue(client);

        await expect(
          service.create('client-123', { isPublic: false, description: 'Test' }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw NotFoundException if professional not found', async () => {
        const client = createMockUser({ hasClientProfile: true });
        mockUserRepository.findById.mockResolvedValue(client);
        mockProfessionalRepository.findById.mockResolvedValue(null);

        await expect(service.create('client-123', directRequestDto)).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if professional is not active', async () => {
        const client = createMockUser({ hasClientProfile: true });
        const inactiveProfessional = createMockProfessional({ 
          status: ProfessionalStatus.PENDING_VERIFICATION,
          active: false,
        });
        
        mockUserRepository.findById.mockResolvedValue(client);
        mockProfessionalRepository.findById.mockResolvedValue(inactiveProfessional);

        await expect(service.create('client-123', directRequestDto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('public requests', () => {
      const publicRequestDto = {
        isPublic: true,
        tradeId: 'trade-123',
        description: 'Looking for an electrician',
      };

      it('should create a public request successfully', async () => {
        const client = createMockUser({ hasClientProfile: true });
        const newRequest = createMockRequest({ isPublic: true, professionalId: null });

        mockUserRepository.findById.mockResolvedValue(client);
        mockRequestRepository.create.mockResolvedValue(newRequest);

        const result = await service.create('client-123', publicRequestDto);

        expect(result).toEqual(newRequest);
        expect(mockRequestRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            isPublic: true,
            professionalId: null,
            tradeId: 'trade-123',
          }),
        );
      });

      it('should throw BadRequestException if tradeId is missing for public request', async () => {
        const client = createMockUser({ hasClientProfile: true });
        mockUserRepository.findById.mockResolvedValue(client);

        await expect(
          service.create('client-123', { isPublic: true, description: 'Test' }),
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

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus (by professional)', () => {
    it('should allow assigned professional to update request status', async () => {
      const request = createMockRequest({ professionalId: 'prof-123' });
      const professional = createMockProfessional({ id: 'prof-123', userId: 'prof-user' });
      const updatedRequest = createMockRequest({ status: RequestStatus.IN_PROGRESS });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(professional);
      mockRequestRepository.update.mockResolvedValue(updatedRequest);

      const result = await service.updateStatus('req-123', 'prof-user', {
        status: RequestStatus.IN_PROGRESS,
      });

      expect(result.status).toBe(RequestStatus.IN_PROGRESS);
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('non-existent', 'prof-user', { status: RequestStatus.IN_PROGRESS }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the assigned professional', async () => {
      const request = createMockRequest({ professionalId: 'prof-123' });
      const differentProfessional = createMockProfessional({ id: 'prof-999' });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(differentProfessional);

      await expect(
        service.updateStatus('req-123', 'other-user', { status: RequestStatus.IN_PROGRESS }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user is not a professional', async () => {
      const request = createMockRequest({ professionalId: 'prof-123' });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.updateStatus('req-123', 'random-user', { status: RequestStatus.IN_PROGRESS }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('acceptQuote', () => {
    it('should allow client to accept a quote', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        status: RequestStatus.PENDING,
        quoteAmount: 5000,
      });
      const acceptedRequest = createMockRequest({ status: RequestStatus.ACCEPTED });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.update.mockResolvedValue(acceptedRequest);

      const result = await service.acceptQuote('req-123', 'client-123');

      expect(result.status).toBe(RequestStatus.ACCEPTED);
    });

    it('should throw ForbiddenException if user is not the client', async () => {
      const request = createMockRequest({ clientId: 'client-123' });

      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.acceptQuote('req-123', 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if request is not pending', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        status: RequestStatus.IN_PROGRESS,
        quoteAmount: 5000,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.acceptQuote('req-123', 'client-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no quote amount exists', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        status: RequestStatus.PENDING,
        quoteAmount: null,
      });

      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(service.acceptQuote('req-123', 'client-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatusByClient', () => {
    it('should allow client to cancel request', async () => {
      const request = createMockRequest({ clientId: 'client-123' });
      const cancelledRequest = createMockRequest({ status: RequestStatus.CANCELLED });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.update.mockResolvedValue(cancelledRequest);

      const result = await service.updateStatusByClient('req-123', 'client-123', {
        status: RequestStatus.CANCELLED,
      });

      expect(result.status).toBe(RequestStatus.CANCELLED);
    });

    it('should throw ForbiddenException if user is not the client', async () => {
      const request = createMockRequest({ clientId: 'client-123' });

      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(
        service.updateStatusByClient('req-123', 'other-user', { status: RequestStatus.CANCELLED }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if client tries to set invalid status', async () => {
      const request = createMockRequest({ clientId: 'client-123' });

      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(
        service.updateStatusByClient('req-123', 'client-123', { status: RequestStatus.IN_PROGRESS }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow client to accept request with quote', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        status: RequestStatus.PENDING,
        quoteAmount: 5000,
      });
      const acceptedRequest = createMockRequest({ status: RequestStatus.ACCEPTED });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockRequestRepository.update.mockResolvedValue(acceptedRequest);

      const result = await service.updateStatusByClient('req-123', 'client-123', {
        status: RequestStatus.ACCEPTED,
      });

      expect(result.status).toBe(RequestStatus.ACCEPTED);
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
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);
      mockRequestRepository.update.mockResolvedValue(updatedRequest);

      const result = await service.addRequestPhoto('req-123', 'client-123', 'http://example.com/new.jpg');

      expect(result.photos).toContain('http://example.com/new.jpg');
    });

    it('should allow assigned professional to add photo', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        professionalId: 'prof-123',
        photos: [],
        status: RequestStatus.IN_PROGRESS,
      });
      const professional = createMockProfessional({ id: 'prof-123', userId: 'prof-user' });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(professional);
      mockRequestRepository.update.mockResolvedValue(request);

      await service.addRequestPhoto('req-123', 'prof-user', 'http://example.com/photo.jpg');

      expect(mockRequestRepository.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        professionalId: 'prof-123',
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.addRequestPhoto('req-123', 'random-user', 'http://example.com/photo.jpg'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for cancelled requests', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        professionalId: 'prof-123',
        status: RequestStatus.CANCELLED,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.addRequestPhoto('req-123', 'client-123', 'http://example.com/photo.jpg'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate photo', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        professionalId: 'prof-123',
        photos: ['http://example.com/existing.jpg'],
        status: RequestStatus.PENDING,
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.addRequestPhoto('req-123', 'client-123', 'http://example.com/existing.jpg'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid URL', async () => {
      const request = createMockRequest({ clientId: 'client-123' });
      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(
        service.addRequestPhoto('req-123', 'client-123', 'not-a-valid-url'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeRequestPhoto', () => {
    it('should allow client to remove photo from request', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        photos: ['photo1.jpg', 'photo2.jpg'],
      });
      const updatedRequest = createMockRequest({ photos: ['photo1.jpg'] });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);
      mockRequestRepository.update.mockResolvedValue(updatedRequest);

      const result = await service.removeRequestPhoto('req-123', 'client-123', 'photo2.jpg');

      expect(result.photos).not.toContain('photo2.jpg');
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const request = createMockRequest({
        clientId: 'client-123',
        professionalId: 'prof-123',
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.removeRequestPhoto('req-123', 'random-user', 'photo.jpg'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByClientId', () => {
    it('should return all requests for a client', async () => {
      const requests = [createMockRequest(), createMockRequest()];
      mockRequestRepository.findByClientId.mockResolvedValue(requests);

      const result = await service.findByClientId('client-123');

      expect(result).toHaveLength(2);
      expect(mockRequestRepository.findByClientId).toHaveBeenCalledWith('client-123');
    });
  });

  describe('findByProfessionalId', () => {
    it('should return all requests for a professional', async () => {
      const requests = [createMockRequest()];
      mockRequestRepository.findByProfessionalId.mockResolvedValue(requests);

      const result = await service.findByProfessionalId('prof-123');

      expect(result).toHaveLength(1);
      expect(mockRequestRepository.findByProfessionalId).toHaveBeenCalledWith('prof-123');
    });
  });

  describe('findPublicRequests', () => {
    it('should return public requests', async () => {
      const requests = [createMockRequest({ isPublic: true })];
      mockRequestRepository.findPublicRequests.mockResolvedValue(requests);

      const result = await service.findPublicRequests(['trade-1', 'trade-2']);

      expect(result).toHaveLength(1);
      expect(mockRequestRepository.findPublicRequests).toHaveBeenCalledWith(['trade-1', 'trade-2']);
    });
  });
});

