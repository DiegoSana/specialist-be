import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import {
  UserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UserStatus, AuthProvider } from '@prisma/client';
import { randomUUID } from 'crypto';
// Cross-context dependency - Client belongs to Profiles context
import {
  ClientRepository,
  CLIENT_REPOSITORY,
} from '../../../profiles/domain/repositories/client.repository';

@Injectable()
export class AuthenticationService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findByEmail(
      registerDto.email,
    );
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const now = new Date();
    const user = await this.userRepository.save(
      new UserEntity(
        randomUUID(),
        registerDto.email,
        hashedPassword,
        registerDto.firstName,
        registerDto.lastName,
        registerDto.phone || null,
        null,
        false,
        UserStatus.PENDING,
        now,
        now,
        false,
        false,
        null,
        null,
        AuthProvider.LOCAL,
      ),
    );

    // Only create client profile if not registering as professional
    // If registering as professional, client profile will not be created
    // (user can create it later if needed)
    if (!registerDto.isProfessional) {
      await this.clientRepository.create({
        userId: user.id,
      });
    }

    // Reload user with profiles
    const userWithProfiles = await this.userRepository.findById(user.id, true);

    const token = this.generateToken(userWithProfiles!);

    return {
      accessToken: token,
      user: {
        id: userWithProfiles!.id,
        email: userWithProfiles!.email,
        firstName: userWithProfiles!.firstName,
        lastName: userWithProfiles!.lastName,
        phone: userWithProfiles!.phone,
        profilePictureUrl: userWithProfiles!.profilePictureUrl,
        status: userWithProfiles!.status,
        hasClientProfile: userWithProfiles!.hasClientProfile,
        hasProfessionalProfile: userWithProfiles!.hasProfessionalProfile,
        isAdmin: userWithProfiles!.isAdminUser(),
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findByEmail(loginDto.email, true);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Allow PENDING users to login (they can be activated later by admin)
    // Only block SUSPENDED and BANNED users
    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      throw new UnauthorizedException('Account is suspended or banned');
    }

    const token = this.generateToken(user);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        profilePictureUrl: user.profilePictureUrl,
        status: user.status,
        hasClientProfile: user.hasClientProfile,
        hasProfessionalProfile: user.hasProfessionalProfile,
        isAdmin: user.isAdminUser(),
      },
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity | null> {
    const user = await this.userRepository.findByEmail(email, true);
    if (!user) {
      return null;
    }

    // Check if user has a password (social login users might not have one)
    if (!user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async validateUserById(id: string): Promise<UserEntity | null> {
    return this.userRepository.findById(id, true);
  }

  async googleLogin(googleUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    profilePictureUrl: string | null;
  }) {
    // Check if user already exists with this Google ID
    let user = await this.userRepository.findByGoogleId(googleUser.googleId);

    if (!user) {
      // Check if user exists with this email
      const existingUser = await this.userRepository.findByEmail(
        googleUser.email,
        true,
      );

      if (existingUser) {
        const now = new Date();
        // Link Google account to existing user (aggregate completo)
        await this.userRepository.save(
          new UserEntity(
            existingUser.id,
            existingUser.email,
            existingUser.password,
            existingUser.firstName,
            existingUser.lastName,
            existingUser.phone,
            existingUser.profilePictureUrl || googleUser.profilePictureUrl,
            existingUser.isAdmin,
            existingUser.status,
            existingUser.createdAt,
            now,
            existingUser.hasClientProfile,
            existingUser.hasProfessionalProfile,
            googleUser.googleId,
            existingUser.facebookId,
            existingUser.authProvider,
          ),
        );
        user = await this.userRepository.findById(existingUser.id, true);
      } else {
        // Create new user with Google account (aggregate completo)
        const now = new Date();
        user = await this.userRepository.save(
          new UserEntity(
            randomUUID(),
            googleUser.email,
            null,
            googleUser.firstName,
            googleUser.lastName,
            null,
            googleUser.profilePictureUrl,
            false,
            UserStatus.ACTIVE,
            now,
            now,
            false,
            false,
            googleUser.googleId,
            null,
            AuthProvider.GOOGLE,
          ),
        );

        // Create client profile for new user
        await this.clientRepository.create({
          userId: user.id,
        });

        // Reload user with profiles
        user = await this.userRepository.findById(user.id, true);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Failed to authenticate with Google');
    }

    // Check if user is banned or suspended
    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      throw new UnauthorizedException('Account is suspended or banned');
    }

    const token = this.generateToken(user);
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        profilePictureUrl: user.profilePictureUrl,
        status: user.status,
        hasClientProfile: user.hasClientProfile,
        hasProfessionalProfile: user.hasProfessionalProfile,
        isAdmin: user.isAdminUser(),
      },
      redirectUrl: frontendUrl,
    };
  }

  async facebookLogin(facebookUser: {
    facebookId: string;
    email: string | null;
    firstName: string;
    lastName: string;
    profilePictureUrl: string | null;
  }) {
    // Check if user already exists with this Facebook ID
    let user = await this.userRepository.findByFacebookId(
      facebookUser.facebookId,
    );

    if (!user) {
      // If we have an email, check if user exists with this email
      if (facebookUser.email) {
        const existingUser = await this.userRepository.findByEmail(
          facebookUser.email,
          true,
        );

        if (existingUser) {
          const now = new Date();
          // Link Facebook account to existing user (aggregate completo)
          await this.userRepository.save(
            new UserEntity(
              existingUser.id,
              existingUser.email,
              existingUser.password,
              existingUser.firstName,
              existingUser.lastName,
              existingUser.phone,
              existingUser.profilePictureUrl || facebookUser.profilePictureUrl,
              existingUser.isAdmin,
              existingUser.status,
              existingUser.createdAt,
              now,
              existingUser.hasClientProfile,
              existingUser.hasProfessionalProfile,
              existingUser.googleId,
              facebookUser.facebookId,
              existingUser.authProvider,
            ),
          );
          user = await this.userRepository.findById(existingUser.id, true);
        }
      }

      if (!user) {
        // Create new user with Facebook account
        // Generate a placeholder email if Facebook didn't provide one
        const email =
          facebookUser.email ||
          `fb_${facebookUser.facebookId}@placeholder.local`;

        const now = new Date();
        user = await this.userRepository.save(
          new UserEntity(
            randomUUID(),
            email,
            null,
            facebookUser.firstName || 'Usuario',
            facebookUser.lastName || 'Facebook',
            null,
            facebookUser.profilePictureUrl,
            false,
            UserStatus.ACTIVE,
            now,
            now,
            false,
            false,
            null,
            facebookUser.facebookId,
            AuthProvider.FACEBOOK,
          ),
        );

        // Create client profile for new user
        await this.clientRepository.create({
          userId: user.id,
        });

        // Reload user with profiles
        user = await this.userRepository.findById(user.id, true);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Failed to authenticate with Facebook');
    }

    // Check if user is banned or suspended
    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      throw new UnauthorizedException('Account is suspended or banned');
    }

    const token = this.generateToken(user);
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        profilePictureUrl: user.profilePictureUrl,
        status: user.status,
        hasClientProfile: user.hasClientProfile,
        hasProfessionalProfile: user.hasProfessionalProfile,
        isAdmin: user.isAdminUser(),
      },
      redirectUrl: frontendUrl,
    };
  }

  private generateToken(user: UserEntity): string {
    const payload = {
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdminUser(),
      hasClientProfile: user.hasClientProfile,
      hasProfessionalProfile: user.hasProfessionalProfile,
    };
    return this.jwtService.sign(payload);
  }
}
