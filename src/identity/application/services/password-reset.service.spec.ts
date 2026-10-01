import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordResetService } from './password-reset.service';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../../domain/repositories/password-reset-token.repository';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { PasswordResetRequestedEvent } from '../../domain/events/password-reset-requested.event';
import { PasswordResetOauthOnlyAttemptedEvent } from '../../domain/events/password-reset-oauth-only-attempted.event';
import { PasswordResetTokenEntity } from '../../domain/entities/password-reset-token.entity';
import { createMockUser } from '../../../__mocks__/test-utils';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockUserRepository: any;
  let mockTokenRepository: any;
  let mockEventBus: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    };

    mockTokenRepository = {
      save: jest.fn(),
      findValidByTokenHash: jest.fn(),
      invalidateAllForUser: jest.fn(),
      markUsed: jest.fn(),
    };

    mockEventBus = { publish: jest.fn() };

    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
        {
          provide: PASSWORD_RESET_TOKEN_REPOSITORY,
          useValue: mockTokenRepository,
        },
        { provide: EVENT_BUS, useValue: mockEventBus },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestReset', () => {
    it('does nothing when no user matches the email (anti-enumeration)', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await service.requestReset('nobody@example.com');

      expect(mockTokenRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('publishes PasswordResetOauthOnlyAttemptedEvent when the user has no password', async () => {
      const oauthUser = createMockUser({
        password: null,
        googleId: 'google-1',
        facebookId: null,
      });
      mockUserRepository.findByEmail.mockResolvedValue(oauthUser);

      await service.requestReset(oauthUser.email);

      expect(mockTokenRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(PasswordResetOauthOnlyAttemptedEvent),
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            userId: oauthUser.id,
            email: oauthUser.email,
            googleLinked: true,
            facebookLinked: false,
          }),
        }),
      );
    });

    it('invalidates old tokens, saves a new one and publishes PasswordResetRequestedEvent for a local user', async () => {
      const localUser = createMockUser({ password: '$2a$10$hashed' });
      mockUserRepository.findByEmail.mockResolvedValue(localUser);
      mockTokenRepository.save.mockImplementation((t) => Promise.resolve(t));

      await service.requestReset(localUser.email);

      expect(mockTokenRepository.invalidateAllForUser).toHaveBeenCalledWith(
        localUser.id,
      );
      expect(mockTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: localUser.id }),
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(PasswordResetRequestedEvent),
      );
      const publishedEvent = mockEventBus.publish.mock.calls[0][0];
      expect(publishedEvent.payload.resetUrl).toContain(
        'http://localhost:3000/es/reset-password?token=',
      );
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException when the token is invalid or expired', async () => {
      mockTokenRepository.findValidByTokenHash.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the token user no longer exists', async () => {
      const tokenRow = PasswordResetTokenEntity.create({
        id: 'token-1',
        userId: 'ghost-user',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 1000),
      });
      mockTokenRepository.findValidByTokenHash.mockResolvedValue(tokenRow);
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.resetPassword('some-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('hashes the new password, saves the user and invalidates the token on success', async () => {
      const user = createMockUser({ id: 'user-123' });
      const tokenRow = PasswordResetTokenEntity.create({
        id: 'token-1',
        userId: user.id,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 1000),
      });
      mockTokenRepository.findValidByTokenHash.mockResolvedValue(tokenRow);
      mockUserRepository.findById.mockResolvedValue(user);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$10$newhashed');
      mockUserRepository.save.mockImplementation((u) => Promise.resolve(u));

      await service.resetPassword('some-token', 'newPassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ password: '$2a$10$newhashed' }),
      );
      expect(mockTokenRepository.markUsed).toHaveBeenCalledWith('token-1');
      expect(mockTokenRepository.invalidateAllForUser).toHaveBeenCalledWith(
        user.id,
      );
    });
  });
});
