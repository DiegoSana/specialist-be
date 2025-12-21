import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { USER_REPOSITORY } from '../../../identity/domain/repositories/user.repository';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { createMockUser } from '../../../__mocks__/test-utils';

describe('ClientService', () => {
  let service: ClientService;
  let mockUserRepository: any;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockUserRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockPrismaService = {
      client: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile when found', async () => {
      const user = createMockUser();
      mockUserRepository.findById.mockResolvedValue(user);

      const result = await service.getProfile('user-123');

      expect(result).toEqual(user);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(
        'user-123',
        true,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    const updateDto = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update user profile successfully', async () => {
      const user = createMockUser();
      const updatedUser = createMockUser({
        firstName: 'Updated',
        lastName: 'Name',
      });

      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-123', updateDto);

      expect(result.firstName).toBe('Updated');
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'user-123',
        updateDto,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate profilePictureUrl if provided', async () => {
      const user = createMockUser();
      mockUserRepository.findById.mockResolvedValue(user);

      const invalidDto = { profilePictureUrl: 'not-a-valid-url' };

      await expect(
        service.updateProfile('user-123', invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid profilePictureUrl', async () => {
      const user = createMockUser();
      const updatedUser = createMockUser({
        profilePictureUrl: 'https://example.com/photo.jpg',
      });

      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const validDto = { profilePictureUrl: 'https://example.com/photo.jpg' };
      const result = await service.updateProfile('user-123', validDto);

      expect(result.profilePictureUrl).toBe('https://example.com/photo.jpg');
    });

    it('should allow empty profilePictureUrl', async () => {
      const user = createMockUser();
      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);

      const emptyDto = { profilePictureUrl: '' };
      await service.updateProfile('user-123', emptyDto);

      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should allow null profilePictureUrl', async () => {
      const user = createMockUser();
      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);

      const nullDto = { profilePictureUrl: null };
      await service.updateProfile('user-123', nullDto as any);

      expect(mockUserRepository.update).toHaveBeenCalled();
    });
  });

  describe('activateClientProfile', () => {
    it('should activate client profile successfully', async () => {
      const user = createMockUser({ hasClientProfile: false });
      const userWithClient = createMockUser({ hasClientProfile: true });

      mockUserRepository.findById
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(userWithClient);
      mockPrismaService.client.create.mockResolvedValue({
        id: 'client-123',
        userId: 'user-123',
      });

      const result = await service.activateClientProfile('user-123');

      expect(result.hasClientProfile).toBe(true);
      expect(mockPrismaService.client.create).toHaveBeenCalledWith({
        data: { userId: 'user-123' },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.activateClientProfile('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if client profile already exists', async () => {
      const userWithClient = createMockUser({ hasClientProfile: true });
      mockUserRepository.findById.mockResolvedValue(userWithClient);

      await expect(service.activateClientProfile('user-123')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
