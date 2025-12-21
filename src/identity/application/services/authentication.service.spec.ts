import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthenticationService } from './authentication.service';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { CLIENT_REPOSITORY } from '../../../profiles/domain/repositories/client.repository';
import { createMockUser } from '../../../__mocks__/test-utils';
import { UserStatus, AuthProvider } from '@prisma/client';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let mockUserRepository: any;
  let mockClientRepository: any;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByGoogleId: jest.fn(),
      findByFacebookId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockClientRepository = {
      create: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
        { provide: CLIENT_REPOSITORY, useValue: mockClientRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthenticationService>(AuthenticationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+5491155551234',
    };

    it('should successfully register a new user', async () => {
      const createdUser = createMockUser({
        id: 'new-user-id',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(createdUser);
      mockUserRepository.findById.mockResolvedValue(createdUser);
      mockClientRepository.create.mockResolvedValue({
        id: 'client-id',
        userId: createdUser.id,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user).toHaveProperty('email', registerDto.email);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockClientRepository.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      const existingUser = createMockUser({ email: registerDto.email });
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should not create client profile when registering as professional', async () => {
      const professionalRegisterDto = { ...registerDto, isProfessional: true };
      const createdUser = createMockUser({ id: 'new-user-id' });

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(createdUser);
      mockUserRepository.findById.mockResolvedValue(createdUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register(professionalRegisterDto);

      expect(mockClientRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should successfully login with valid credentials', async () => {
      const user = createMockUser({
        email: loginDto.email,
        password: 'hashed-password',
        status: UserStatus.ACTIVE,
      });

      mockUserRepository.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user).toHaveProperty('email', loginDto.email);
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const user = createMockUser({ email: loginDto.email });
      mockUserRepository.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for suspended user', async () => {
      const suspendedUser = createMockUser({
        email: loginDto.email,
        status: UserStatus.SUSPENDED,
      });

      mockUserRepository.findByEmail.mockResolvedValue(suspendedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for banned user', async () => {
      const bannedUser = createMockUser({
        email: loginDto.email,
        status: UserStatus.BANNED,
      });

      mockUserRepository.findByEmail.mockResolvedValue(bannedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should allow PENDING users to login', async () => {
      const pendingUser = createMockUser({
        email: loginDto.email,
        status: UserStatus.PENDING,
      });

      mockUserRepository.findByEmail.mockResolvedValue(pendingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result.user.status).toBe(UserStatus.PENDING);
    });
  });

  describe('validateUser', () => {
    it('should return user for valid credentials', async () => {
      const user = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual(user);
    });

    it('should return null for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'password',
      );

      expect(result).toBeNull();
    });

    it('should return null for user without password (social login)', async () => {
      const socialUser = createMockUser({ password: null as any });
      mockUserRepository.findByEmail.mockResolvedValue(socialUser);

      const result = await service.validateUser(
        'social@example.com',
        'password',
      );

      expect(result).toBeNull();
    });

    it('should return null for invalid password', async () => {
      const user = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });
  });

  describe('googleLogin', () => {
    const googleUser = {
      googleId: 'google-123',
      email: 'google@example.com',
      firstName: 'Google',
      lastName: 'User',
      profilePictureUrl: 'https://example.com/photo.jpg',
    };

    it('should login existing user with Google ID', async () => {
      const existingUser = createMockUser({
        googleId: googleUser.googleId,
        email: googleUser.email,
        status: UserStatus.ACTIVE,
      });

      mockUserRepository.findByGoogleId.mockResolvedValue(existingUser);

      const result = await service.googleLogin(googleUser);

      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user.email).toBe(googleUser.email);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should link Google account to existing user with same email', async () => {
      const existingUser = createMockUser({
        email: googleUser.email,
        googleId: null,
      });

      const updatedUser = createMockUser({
        email: googleUser.email,
        googleId: googleUser.googleId,
      });

      mockUserRepository.findByGoogleId.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);
      mockUserRepository.findById.mockResolvedValue(updatedUser);

      const result = await service.googleLogin(googleUser);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        existingUser.id,
        expect.objectContaining({ googleId: googleUser.googleId }),
      );
      expect(result).toHaveProperty('accessToken');
    });

    it('should create new user for new Google account', async () => {
      const newUser = createMockUser({
        email: googleUser.email,
        googleId: googleUser.googleId,
        authProvider: AuthProvider.GOOGLE,
      });

      mockUserRepository.findByGoogleId.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(newUser);
      mockUserRepository.findById.mockResolvedValue(newUser);
      mockClientRepository.create.mockResolvedValue({ id: 'client-id' });

      const result = await service.googleLogin(googleUser);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: googleUser.email,
          googleId: googleUser.googleId,
          authProvider: AuthProvider.GOOGLE,
          status: UserStatus.ACTIVE,
        }),
      );
      expect(mockClientRepository.create).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
    });

    it('should throw UnauthorizedException for suspended Google user', async () => {
      const suspendedUser = createMockUser({
        googleId: googleUser.googleId,
        status: UserStatus.SUSPENDED,
      });

      mockUserRepository.findByGoogleId.mockResolvedValue(suspendedUser);

      await expect(service.googleLogin(googleUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('facebookLogin', () => {
    const facebookUser = {
      facebookId: 'facebook-123',
      email: 'facebook@example.com',
      firstName: 'Facebook',
      lastName: 'User',
      profilePictureUrl: 'https://example.com/photo.jpg',
    };

    it('should login existing user with Facebook ID', async () => {
      const existingUser = createMockUser({
        facebookId: facebookUser.facebookId,
        email: facebookUser.email,
        status: UserStatus.ACTIVE,
      });

      mockUserRepository.findByFacebookId.mockResolvedValue(existingUser);

      const result = await service.facebookLogin(facebookUser);

      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user.email).toBe(facebookUser.email);
    });

    it('should create placeholder email for Facebook users without email', async () => {
      const facebookUserNoEmail = { ...facebookUser, email: null };
      const newUser = createMockUser({
        email: `fb_${facebookUser.facebookId}@placeholder.local`,
        facebookId: facebookUser.facebookId,
      });

      mockUserRepository.findByFacebookId.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(newUser);
      mockUserRepository.findById.mockResolvedValue(newUser);
      mockClientRepository.create.mockResolvedValue({ id: 'client-id' });

      const result = await service.facebookLogin(facebookUserNoEmail);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: `fb_${facebookUser.facebookId}@placeholder.local`,
        }),
      );
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('validateUserById', () => {
    it('should return user by ID', async () => {
      const user = createMockUser();
      mockUserRepository.findById.mockResolvedValue(user);

      const result = await service.validateUserById(user.id);

      expect(result).toEqual(user);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(user.id, true);
    });

    it('should return null for non-existent ID', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await service.validateUserById('non-existent-id');

      expect(result).toBeNull();
    });
  });
});
