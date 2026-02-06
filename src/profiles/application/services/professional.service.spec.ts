import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ProfessionalService } from './professional.service';
import { ProfileToggleService } from './profile-toggle.service';
import { PROFESSIONAL_REPOSITORY } from '../../domain/repositories/professional.repository';
import { PROFESSIONAL_QUERY_REPOSITORY } from '../../domain/queries/professional.query-repository';
import { TRADE_REPOSITORY } from '../../domain/repositories/trade.repository';
import { UserService } from '../../../identity/application/services/user.service';
import { RequestService } from '../../../requests/application/services/request.service';
import {
  createMockUser,
  createMockProfessional,
  createMockRequest,
} from '../../../__mocks__/test-utils';
import { RequestStatus, UserStatus } from '@prisma/client';

describe('ProfessionalService', () => {
  let service: ProfessionalService;
  let mockProfessionalRepository: any;
  let mockProfessionalQueryRepository: any;
  let mockUserService: any;
  let mockTradeRepository: any;
  let mockRequestService: any;
  let mockProfileToggleService: any;

  beforeEach(async () => {
    mockProfessionalRepository = {
      search: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      save: jest.fn(),
      updateRating: jest.fn(),
    };

    mockProfessionalQueryRepository = {
      getProfessionalStats: jest.fn(),
      findAllForAdmin: jest.fn(),
      findByIdForAdmin: jest.fn(),
    };

    mockUserService = {
      findById: jest.fn(),
      findByIdOrFail: jest.fn(),
    };

    mockTradeRepository = {
      findById: jest.fn(),
    };

    mockRequestService = {
      findByProviderId: jest.fn(),
    };

    mockProfileToggleService = {
      activateProfessionalProfile: jest.fn(),
      activateCompanyProfile: jest.fn(),
      getUserProfiles: jest.fn(),
      getActiveProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalService,
        {
          provide: PROFESSIONAL_REPOSITORY,
          useValue: mockProfessionalRepository,
        },
        {
          provide: PROFESSIONAL_QUERY_REPOSITORY,
          useValue: mockProfessionalQueryRepository,
        },
        { provide: UserService, useValue: mockUserService },
        { provide: TRADE_REPOSITORY, useValue: mockTradeRepository },
        { provide: RequestService, useValue: mockRequestService },
        { provide: ProfileToggleService, useValue: mockProfileToggleService },
      ],
    }).compile();

    service = module.get<ProfessionalService>(ProfessionalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return sanitized professionals for public search', async () => {
      const professionals = [
        createMockProfessional({
          id: 'prof-1',
          website: 'https://example.com',
          address: 'Secret Address 123',
        }),
        createMockProfessional({
          id: 'prof-2',
          website: 'https://example2.com',
          address: 'Secret Address 456',
        }),
      ];

      mockProfessionalRepository.search.mockResolvedValue(professionals);

      const result = await service.search({ search: 'electricista' });

      expect(result).toHaveLength(2);
      // Should NOT include contact info
      expect(result[0]).not.toHaveProperty('whatsapp');
      expect(result[0]).not.toHaveProperty('website');
      expect(result[0]).not.toHaveProperty('address');
      // Should include public info
      expect(result[0]).toHaveProperty('id', 'prof-1');
      expect(result[0]).toHaveProperty('zone');
      expect(result[0]).toHaveProperty('city');
    });

    it('should only search for active professionals', async () => {
      mockProfessionalRepository.search.mockResolvedValue([]);

      await service.search({ search: 'plomero', tradeId: 'trade-123' });

      expect(mockProfessionalRepository.search).toHaveBeenCalledWith({
        search: 'plomero',
        tradeId: 'trade-123',
        canOperate: true,
        userVerified: false,
      });
    });
  });

  describe('findById', () => {
    it('should return sanitized professional for public access', async () => {
      const professional = createMockProfessional({
        website: 'https://example.com',
        address: 'Secret Address',
      });

      mockProfessionalRepository.findById.mockResolvedValue(professional);

      const result = await service.findById('prof-123');

      expect(result).not.toHaveProperty('whatsapp');
      expect(result).not.toHaveProperty('website');
      expect(result).not.toHaveProperty('address');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('city');
      expect(result).toHaveProperty('zone');
    });

    it('should throw NotFoundException if professional not found', async () => {
      mockProfessionalRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include user data if available', async () => {
      const professional = createMockProfessional();
      (professional as any).user = {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        profilePictureUrl: null,
      };

      mockProfessionalRepository.findById.mockResolvedValue(professional);

      const result = await service.findById('prof-123');

      expect(result).toHaveProperty('user');
      expect((result as any).user).toHaveProperty('firstName', 'John');
    });
  });

  describe('findByUserId', () => {
    it('should return professional with combined gallery for own profile', async () => {
      const professional = createMockProfessional({
        gallery: ['gallery1.jpg', 'gallery2.jpg'],
      });
      const completedRequests = [
        createMockRequest({
          id: 'req-1',
          status: RequestStatus.DONE,
          photos: ['work1.jpg', 'work2.jpg'],
        }),
        createMockRequest({
          id: 'req-2',
          status: RequestStatus.DONE,
          photos: ['work3.jpg'],
        }),
        createMockRequest({
          id: 'req-3',
          status: RequestStatus.PENDING, // Not done, should be excluded
          photos: ['pending.jpg'],
        }),
      ];

      mockProfessionalRepository.findByUserId.mockResolvedValue(professional);
      mockRequestService.findByProviderId.mockResolvedValue(
        completedRequests,
      );

      const result = await service.findByUserId('user-123');

      expect(result).toHaveProperty('combinedGallery');
      expect((result as any).combinedGallery).toContain('gallery1.jpg');
      expect((result as any).combinedGallery).toContain('gallery2.jpg');
      expect((result as any).combinedGallery).toContain('work1.jpg');
      expect((result as any).combinedGallery).toContain('work2.jpg');
      expect((result as any).combinedGallery).toContain('work3.jpg');
      expect((result as any).combinedGallery).not.toContain('pending.jpg');
    });

    it('should throw NotFoundException if professional not found', async () => {
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);

      await expect(service.findByUserId('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createProfile', () => {
    const createDto = {
      tradeIds: ['trade-1', 'trade-2'],
      description: 'Professional description',
      experienceYears: 5,
      zone: 'Centro',
      city: 'Bariloche',
    };

    it('should successfully create a professional profile', async () => {
      const user = createMockUser({
        id: 'user-123',
        status: UserStatus.ACTIVE,
      });
      const updatedUser = createMockUser({
        id: 'user-123',
        status: UserStatus.ACTIVE,
        hasProfessionalProfile: true,
      });
      const newProfessional = createMockProfessional({ userId: 'user-123' });

      mockUserService.findByIdOrFail
        .mockResolvedValueOnce(user) // First call to check user exists
        .mockResolvedValueOnce(updatedUser); // After creation
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);
      mockTradeRepository.findById.mockResolvedValue({
        id: 'trade-1',
        name: 'Electricista',
      });
      mockProfessionalRepository.save.mockResolvedValue(newProfessional);

      const result = await service.createProfile('user-123', createDto);

      expect(result).toHaveProperty('professional');
      expect(result).toHaveProperty('user');
      expect(mockProfessionalRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserService.findByIdOrFail.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.createProfile('non-existent', createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is not active', async () => {
      const inactiveUser = createMockUser({ status: UserStatus.PENDING });
      // Override isActive to return false for PENDING status
      jest.spyOn(inactiveUser, 'isActive').mockReturnValue(false);

      mockUserService.findByIdOrFail.mockResolvedValue(inactiveUser);

      await expect(
        service.createProfile('user-123', createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if professional profile already exists', async () => {
      const user = createMockUser({ status: UserStatus.ACTIVE });
      const existingProfessional = createMockProfessional();

      mockUserService.findByIdOrFail.mockResolvedValue(user);
      mockProfessionalRepository.findByUserId.mockResolvedValue(
        existingProfessional,
      );

      await expect(
        service.createProfile('user-123', createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if trade not found', async () => {
      const user = createMockUser({ status: UserStatus.ACTIVE });

      mockUserService.findByIdOrFail.mockResolvedValue(user);
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);
      mockTradeRepository.findById.mockResolvedValue(null);

      await expect(
        service.createProfile('user-123', createDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    const updateDto = {
      description: 'Updated description',
      experienceYears: 10,
    };
    const mockUser = createMockUser({ id: 'user-123', isAdmin: false });

    it('should successfully update own profile', async () => {
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'user-123',
      });
      const updatedProfessional = createMockProfessional({
        ...professional,
        description: 'Updated description',
        experienceYears: 10,
      });

      mockProfessionalRepository.findById.mockResolvedValue(professional);
      mockProfessionalRepository.save.mockResolvedValue(updatedProfessional);

      const result = await service.updateProfile(mockUser, 'prof-123', updateDto);

      expect(result.description).toBe('Updated description');
      expect(mockProfessionalRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if professional not found', async () => {
      mockProfessionalRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateProfile(mockUser, 'non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating another users profile', async () => {
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'other-user',
      });

      mockProfessionalRepository.findById.mockResolvedValue(professional);

      await expect(
        service.updateProfile(mockUser, 'prof-123', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to update any profile', async () => {
      const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'other-user',
      });
      const updatedProfessional = createMockProfessional({
        ...professional,
        description: 'Admin updated',
      });

      mockProfessionalRepository.findById.mockResolvedValue(professional);
      mockProfessionalRepository.save.mockResolvedValue(updatedProfessional);

      const result = await service.updateProfile(adminUser, 'prof-123', {
        description: 'Admin updated',
      });

      expect(result.description).toBe('Admin updated');
    });

    it('should validate trades when updating tradeIds', async () => {
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'user-123',
      });

      mockProfessionalRepository.findById.mockResolvedValue(professional);
      mockTradeRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateProfile(mockUser, 'prof-123', {
          tradeIds: ['invalid-trade'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addGalleryItem', () => {
    const mockUser = createMockUser({ id: 'user-123', isAdmin: false });

    it('should add new image to gallery', async () => {
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'user-123',
        gallery: ['existing.jpg'],
      });
      const updatedProfessional = createMockProfessional({
        gallery: ['existing.jpg', 'new.jpg'],
      });

      mockProfessionalRepository.findByUserId.mockResolvedValue(professional);
      mockProfessionalRepository.save.mockResolvedValue(updatedProfessional);

      const result = await service.addGalleryItem(mockUser, 'new.jpg');

      expect(result.gallery).toContain('new.jpg');
      expect(mockProfessionalRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if image already in gallery', async () => {
      const professional = createMockProfessional({
        userId: 'user-123',
        gallery: ['existing.jpg'],
      });

      mockProfessionalRepository.findByUserId.mockResolvedValue(professional);

      await expect(
        service.addGalleryItem(mockUser, 'existing.jpg'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if professional not found', async () => {
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.addGalleryItem(mockUser, 'new.jpg'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeGalleryItem', () => {
    const mockUser = createMockUser({ id: 'user-123', isAdmin: false });

    it('should remove image from gallery', async () => {
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'user-123',
        gallery: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
      });
      const updatedProfessional = createMockProfessional({
        gallery: ['img1.jpg', 'img3.jpg'],
      });

      mockProfessionalRepository.findByUserId.mockResolvedValue(professional);
      mockProfessionalRepository.save.mockResolvedValue(updatedProfessional);

      const result = await service.removeGalleryItem(mockUser, 'img2.jpg');

      expect(result.gallery).not.toContain('img2.jpg');
      expect(mockProfessionalRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if professional not found', async () => {
      mockProfessionalRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.removeGalleryItem(mockUser, 'img.jpg'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
