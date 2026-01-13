import { Injectable } from '@nestjs/common';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateProfessionalStatusDto } from './dto/update-professional-status.dto';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { UserService } from '../../identity/application/services/user.service';
import { ProfessionalService } from '../../profiles/application/services/professional.service';
import { UserEntity } from '../../identity/domain/entities/user.entity';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly professionalService: ProfessionalService,
    private readonly prisma: PrismaService,
  ) {}

  async getAllUsers(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          client: {
            select: {
              id: true,
            },
          },
          professional: {
            select: {
              id: true,
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(userId: string, actingUser: UserEntity) {
    return this.userService.findByIdForUser(userId, actingUser);
  }

  async updateUserStatus(
    userId: string,
    updateDto: UpdateUserStatusDto,
    actingUser: UserEntity,
  ) {
    return this.userService.updateStatusForUser(
      userId,
      actingUser,
      updateDto.status,
    );
  }

  async getAllProfessionals(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [professionals, total] = await Promise.all([
      this.prisma.professional.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          trades: {
            include: {
              trade: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.professional.count(),
    ]);

    return {
      data: professionals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateProfessionalStatus(
    professionalId: string,
    updateDto: UpdateProfessionalStatusDto,
    user: UserEntity,
  ) {
    return this.professionalService.updateStatus(
      professionalId,
      updateDto.status,
      user,
    );
  }
}
