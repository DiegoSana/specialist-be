import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { CLIENT_REPOSITORY } from '../../domain/repositories/client.repository';
import { UserService } from '../../../identity/application/services/user.service';
import { createMockUser } from '../../../__mocks__/test-utils';

describe('ClientService', () => {
  let service: ClientService;
  let mockUserService: any;
  let mockClientRepository: any;

  beforeEach(async () => {
    mockUserService = {
      findById: jest.fn(),
      findByIdOrFail: jest.fn(),
      update: jest.fn(),
    };

    mockClientRepository = {
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        { provide: CLIENT_REPOSITORY, useValue: mockClientRepository },
        { provide: UserService, useValue: mockUserService },
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
      mockUserService.findByIdOrFail.mockResolvedValue(user);

      const result = await service.getProfile('user-123');

      expect(result).toEqual(user);
      expect(mockUserService.findByIdOrFail).toHaveBeenCalledWith(
        'user-123',
        true,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.findByIdOrFail.mockRejectedValue(
        new NotFoundException('User not found'),
      );

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
      const updatedUser = createMockUser({
        firstName: 'Updated',
        lastName: 'Name',
      });
      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-123', updateDto);

      expect(result.firstName).toBe('Updated');
      expect(mockUserService.update).toHaveBeenCalledWith(
        'user-123',
        updateDto,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.update.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.updateProfile('non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate profilePictureUrl if provided', async () => {
      const invalidDto = { profilePictureUrl: 'not-a-valid-url' };

      await expect(
        service.updateProfile('user-123', invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid profilePictureUrl', async () => {
      const updatedUser = createMockUser({
        profilePictureUrl: 'https://example.com/photo.jpg',
      });
      mockUserService.update.mockResolvedValue(updatedUser);

      const validDto = { profilePictureUrl: 'https://example.com/photo.jpg' };
      const result = await service.updateProfile('user-123', validDto);

      expect(result.profilePictureUrl).toBe('https://example.com/photo.jpg');
    });

    it('should allow empty profilePictureUrl', async () => {
      const user = createMockUser();
      mockUserService.update.mockResolvedValue(user);

      const emptyDto = { profilePictureUrl: '' };
      await service.updateProfile('user-123', emptyDto);

      expect(mockUserService.update).toHaveBeenCalled();
    });

    it('should allow null profilePictureUrl', async () => {
      const user = createMockUser();
      mockUserService.update.mockResolvedValue(user);

      const nullDto = { profilePictureUrl: null };
      await service.updateProfile('user-123', nullDto as any);

      expect(mockUserService.update).toHaveBeenCalled();
    });
  });

  describe('activateClientProfile', () => {
    it('should activate client profile successfully', async () => {
      const user = createMockUser({ hasClientProfile: false });
      const userWithClient = createMockUser({ hasClientProfile: true });

      mockUserService.findByIdOrFail
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(userWithClient);
      mockClientRepository.save.mockResolvedValue({
        id: 'client-123',
        userId: 'user-123',
      });

      const result = await service.activateClientProfile('user-123');

      expect(result.hasClientProfile).toBe(true);
      expect(mockClientRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.findByIdOrFail.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.activateClientProfile('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if client profile already exists', async () => {
      const userWithClient = createMockUser({ hasClientProfile: true });
      mockUserService.findByIdOrFail.mockResolvedValue(userWithClient);

      await expect(service.activateClientProfile('user-123')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
