import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { UserStatus, AuthProvider } from '@prisma/client';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string, includeProfiles: boolean = false): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: includeProfiles
        ? {
            client: true,
            professional: true,
          }
        : undefined,
    });

    if (!user) return null;

    return this.toEntity(user);
  }

  async findById(id: string, includeProfiles: boolean = false): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: includeProfiles
        ? {
            client: true,
            professional: true,
          }
        : undefined,
    });

    if (!user) return null;

    return this.toEntity(user);
  }

  async findByGoogleId(googleId: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { googleId },
      include: {
        client: true,
        professional: true,
      },
    });

    if (!user) return null;

    return this.toEntity(user);
  }

  async findByFacebookId(facebookId: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { facebookId },
      include: {
        client: true,
        professional: true,
      },
    });

    if (!user) return null;

    return this.toEntity(user);
  }

  async create(
    userData: {
      email: string;
      password: string | null;
      firstName: string;
      lastName: string;
      phone?: string | null;
      profilePictureUrl?: string | null;
      isAdmin?: boolean;
      status: UserStatus;
      googleId?: string;
      facebookId?: string;
      authProvider?: AuthProvider;
    },
  ): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone || null,
        profilePictureUrl: userData.profilePictureUrl || null,
        isAdmin: userData.isAdmin || false,
        status: userData.status,
        googleId: userData.googleId || null,
        facebookId: userData.facebookId || null,
        authProvider: userData.authProvider || AuthProvider.LOCAL,
      },
    });

    return this.toEntity(user);
  }

  async update(id: string, data: Partial<UserEntity> & { googleId?: string; facebookId?: string }): Promise<UserEntity> {
    const updateData: any = {};
    if (data.email) updateData.email = data.email;
    if (data.password) updateData.password = data.password;
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    // Handle profilePictureUrl - allow null to clear it, or string to set it
    if (data.profilePictureUrl !== undefined) {
      updateData.profilePictureUrl = data.profilePictureUrl;
    }
    if (data.isAdmin !== undefined) updateData.isAdmin = data.isAdmin;
    if (data.status) updateData.status = data.status;
    if (data.googleId !== undefined) updateData.googleId = data.googleId;
    if (data.facebookId !== undefined) updateData.facebookId = data.facebookId;

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return this.toEntity(user);
  }

  private toEntity(user: any): UserEntity {
    return new UserEntity(
      user.id,
      user.email,
      user.password,
      user.firstName,
      user.lastName,
      user.phone,
      user.profilePictureUrl || null,
      user.isAdmin || false,
      user.status as UserStatus,
      user.createdAt,
      user.updatedAt,
      !!user.client,
      !!user.professional,
      user.googleId || null,
      user.facebookId || null,
      user.authProvider || AuthProvider.LOCAL,
    );
  }
}

