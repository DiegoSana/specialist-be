import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserEntity } from '../../domain/entities/user.entity';
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
            company: true,
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
            company: true,
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
        company: true,
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
        company: true,
      },
    });

    if (!user) return null;

    return PrismaUserMapper.toDomain(user);
  }

  async save(user: UserEntity): Promise<UserEntity> {
    const persistence = PrismaUserMapper.toPersistenceSave(user);

    const saved = await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        ...persistence,
      },
      update: {
        ...persistence,
      },
      include: {
        client: { select: { id: true } },
        professional: { select: { id: true } },
        company: { select: { id: true } },
      },
    });

    return PrismaUserMapper.toDomain(saved);
  }
}
