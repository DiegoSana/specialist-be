import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { UserRepository, USER_REPOSITORY } from '../../user-management/domain/repositories/user.repository';
import { ProfessionalRepository, PROFESSIONAL_REPOSITORY } from '../../service/domain/repositories/professional.repository';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateProfessionalStatusDto } from './dto/update-professional-status.dto';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PROFESSIONAL_REPOSITORY) private readonly professionalRepository: ProfessionalRepository,
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

  async getUserById(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUserStatus(userId: string, updateDto: UpdateUserStatusDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.userRepository.update(userId, { status: updateDto.status });
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
  ) {
    const professional = await this.professionalRepository.findById(professionalId);
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    return this.professionalRepository.update(professionalId, {
      status: updateDto.status,
    });
  }
}
