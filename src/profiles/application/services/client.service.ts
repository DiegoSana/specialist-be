import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
// Cross-context dependency - using Service instead of Repository (DDD)
import { UserService } from '../../../identity/application/services/user.service';
import { UserEntity } from '../../../identity/domain/entities/user.entity';

@Injectable()
export class ClientService {
  constructor(
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

  async getProfile(userId: string): Promise<UserEntity> {
    return this.userService.findByIdOrFail(userId);
  }

  async updateProfile(userId: string, updateDto: UpdateUserDto): Promise<UserEntity> {
    // Validate profilePictureUrl if provided
    if (updateDto.profilePictureUrl !== undefined && updateDto.profilePictureUrl !== null && updateDto.profilePictureUrl !== '') {
      try {
        new URL(updateDto.profilePictureUrl);
      } catch {
        throw new BadRequestException('profilePictureUrl must be a valid URL');
      }
    }

    return this.userService.update(userId, updateDto);
  }

  async activateClientProfile(userId: string): Promise<UserEntity> {
    // Check if user exists
    const user = await this.userService.findByIdOrFail(userId, true);

    // Check if client profile already exists
    if (user.hasClientProfile) {
      throw new ConflictException('Client profile already exists');
    }

    // Create client profile
    await this.prisma.client.create({
      data: {
        userId,
      },
    });

    // Return updated user with client profile
    return this.userService.findByIdOrFail(userId, true);
  }
}
