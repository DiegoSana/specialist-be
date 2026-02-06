import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VerificationService } from './verification.service';
import {
  VERIFICATION_SERVICE,
  VerificationService as VerificationServicePort,
} from '../../domain/ports/verification.service';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { createMockUser } from '../../../__mocks__/test-utils';

describe('VerificationService', () => {
  let service: VerificationService;
  let mockVerificationPort: jest.Mocked<VerificationServicePort>;
  let mockUserRepository: jest.Mocked<Pick<UserRepository, 'findById' | 'save'>>;

  const userId = 'user-123';

  beforeEach(async () => {
    mockVerificationPort = {
      requestPhoneVerification: jest.fn().mockResolvedValue('sid-phone'),
      confirmPhoneVerification: jest.fn().mockResolvedValue(true),
      requestEmailVerification: jest.fn().mockResolvedValue('sid-email'),
      confirmEmailVerification: jest.fn().mockResolvedValue(true),
    };

    mockUserRepository = {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: VERIFICATION_SERVICE, useValue: mockVerificationPort },
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPhoneVerification', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.requestPhoneVerification(userId),
      ).rejects.toThrow(NotFoundException);

      expect(mockVerificationPort.requestPhoneVerification).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user has no phone', async () => {
      const user = createMockUser({ id: userId, phone: null });
      mockUserRepository.findById.mockResolvedValue(user);

      await expect(
        service.requestPhoneVerification(userId),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationPort.requestPhoneVerification).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when phone is already verified', async () => {
      const user = createMockUser({ id: userId, phoneVerified: true });
      mockUserRepository.findById.mockResolvedValue(user);

      await expect(
        service.requestPhoneVerification(userId),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationPort.requestPhoneVerification).not.toHaveBeenCalled();
    });

    it('should call port and succeed when user has unverified phone', async () => {
      const user = createMockUser({
        id: userId,
        phone: '+5492944123456',
        phoneVerified: false,
      });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.requestPhoneVerification(userId);

      expect(mockVerificationPort.requestPhoneVerification).toHaveBeenCalledWith(
        '+5492944123456',
      );
    });

    it('should throw BadRequestException when Phone format is invalid', async () => {
      const user = createMockUser({
        id: userId,
        phone: 'invalid',
        phoneVerified: false,
      });
      mockUserRepository.findById.mockResolvedValue(user);

      await expect(
        service.requestPhoneVerification(userId),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationPort.requestPhoneVerification).not.toHaveBeenCalled();
    });
  });

  describe('confirmPhoneVerification', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.confirmPhoneVerification(userId, '123456'),
      ).rejects.toThrow(NotFoundException);

      expect(mockVerificationPort.confirmPhoneVerification).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user has no phone', async () => {
      const user = createMockUser({ id: userId, phone: null });
      mockUserRepository.findById.mockResolvedValue(user);

      await expect(
        service.confirmPhoneVerification(userId, '123456'),
      ).rejects.toThrow(BadRequestException);

      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when phone is already verified', async () => {
      const user = createMockUser({
        id: userId,
        phone: '+5492944123456',
        phoneVerified: true,
      });
      mockUserRepository.findById.mockResolvedValue(user);

      await expect(
        service.confirmPhoneVerification(userId, '123456'),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationPort.confirmPhoneVerification).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when code is invalid', async () => {
      const user = createMockUser({
        id: userId,
        phone: '+5492944123456',
        phoneVerified: false,
      });
      mockUserRepository.findById.mockResolvedValue(user);
      mockVerificationPort.confirmPhoneVerification.mockResolvedValue(false);

      await expect(
        service.confirmPhoneVerification(userId, '000000'),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationPort.confirmPhoneVerification).toHaveBeenCalledWith(
        '+5492944123456',
        '000000',
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should verify code and save user with phone verified on success', async () => {
      const user = createMockUser({
        id: userId,
        phone: '+5492944123456',
        phoneVerified: false,
      });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.confirmPhoneVerification(userId, '123456');

      expect(mockVerificationPort.confirmPhoneVerification).toHaveBeenCalledWith(
        '+5492944123456',
        '123456',
      );
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      const savedUser = mockUserRepository.save.mock.calls[0][0];
      expect(savedUser.phoneVerified).toBe(true);
    });
  });

  describe('requestEmailVerification', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.requestEmailVerification(userId),
      ).rejects.toThrow(NotFoundException);

      expect(mockVerificationPort.requestEmailVerification).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when email is already verified', async () => {
      const user = createMockUser({ id: userId, emailVerified: true });
      mockUserRepository.findById.mockResolvedValue(user);

      await expect(
        service.requestEmailVerification(userId),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationPort.requestEmailVerification).not.toHaveBeenCalled();
    });

    it('should call port and succeed when email is not verified', async () => {
      const user = createMockUser({
        id: userId,
        email: 'user@example.com',
        emailVerified: false,
      });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.requestEmailVerification(userId);

      expect(mockVerificationPort.requestEmailVerification).toHaveBeenCalledWith(
        'user@example.com',
      );
    });
  });

  describe('confirmEmailVerification', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.confirmEmailVerification(userId, '123456'),
      ).rejects.toThrow(NotFoundException);

      expect(mockVerificationPort.confirmEmailVerification).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when email is already verified', async () => {
      const user = createMockUser({
        id: userId,
        email: 'user@example.com',
        emailVerified: true,
      });
      mockUserRepository.findById.mockResolvedValue(user);

      await expect(
        service.confirmEmailVerification(userId, '123456'),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationPort.confirmEmailVerification).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when code is invalid', async () => {
      const user = createMockUser({
        id: userId,
        email: 'user@example.com',
        emailVerified: false,
      });
      mockUserRepository.findById.mockResolvedValue(user);
      mockVerificationPort.confirmEmailVerification.mockResolvedValue(false);

      await expect(
        service.confirmEmailVerification(userId, '000000'),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationPort.confirmEmailVerification).toHaveBeenCalledWith(
        'user@example.com',
        '000000',
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should verify code and save user with email verified on success', async () => {
      const user = createMockUser({
        id: userId,
        email: 'user@example.com',
        emailVerified: false,
      });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.confirmEmailVerification(userId, '123456');

      expect(mockVerificationPort.confirmEmailVerification).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
      );
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      const savedUser = mockUserRepository.save.mock.calls[0][0];
      expect(savedUser.emailVerified).toBe(true);
    });
  });
});
