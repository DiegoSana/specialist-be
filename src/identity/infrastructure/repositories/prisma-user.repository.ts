import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { UserStatus, AuthProvider } from '@prisma/client';
import { PrismaUserMapper } from '../mappers/user.prisma-mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(
    email: string,
    includeProfiles: boolean = false,
  ): Promise<UserEntity | null> {
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

    return PrismaUserMapper.toDomain(user);
  }

  async findById(
    id: string,
    includeProfiles: boolean = false,
  ): Promise<UserEntity | null> {
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

    return PrismaUserMapper.toDomain(user);
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

    return PrismaUserMapper.toDomain(user);
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

    return PrismaUserMapper.toDomain(user);
  }

  async create(userData: {
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
  }): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        ...PrismaUserMapper.toPersistenceCreate(userData),
      },
    });

    return PrismaUserMapper.toDomain(user);
  }

  async update(
    id: string,
    data: Partial<UserEntity> & { googleId?: string; facebookId?: string },
  ): Promise<UserEntity> {
    const updateData = PrismaUserMapper.toPersistenceUpdate({
      ...data,
      googleId: data.googleId ?? undefined,
      facebookId: data.facebookId ?? undefined,
    });

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      // Incluir relaciones para que los flags derivados queden correctos.
      include: {
        client: { select: { id: true } },
        professional: { select: { id: true } },
      },
    });

    return PrismaUserMapper.toDomain(user);
  }
}
