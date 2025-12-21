import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
// Cross-context dependencies
import {
  UserRepository,
  USER_REPOSITORY,
} from '../../../identity/domain/repositories/user.repository';
import { UserEntity } from '../../../identity/domain/entities/user.entity';

@Injectable()
export class ClientService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getProfile(userId: string): Promise<UserEntity> {
    // Importante: los flags hasClientProfile/hasProfessionalProfile se derivan
    // de relaciones (client/professional). Hay que incluirlas.
    const user = await this.userRepository.findById(userId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(
    userId: string,
    updateDto: UpdateUserDto,
  ): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate profilePictureUrl if provided
    if (
      updateDto.profilePictureUrl !== undefined &&
      updateDto.profilePictureUrl !== null &&
      updateDto.profilePictureUrl !== ''
    ) {
      try {
        new URL(updateDto.profilePictureUrl);
      } catch {
        throw new BadRequestException('profilePictureUrl must be a valid URL');
      }
    }

    const now = new Date();
    return this.userRepository.save(
      user.withUpdatedProfile({
        firstName: updateDto.firstName,
        lastName: updateDto.lastName,
        phone: updateDto.phone,
        profilePictureUrl: updateDto.profilePictureUrl as any,
        now,
      }),
    );
  }

  async activateClientProfile(userId: string): Promise<UserEntity> {
    // Check if user exists
    const user = await this.userRepository.findById(userId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }

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
    return this.userRepository.findById(userId, true) as Promise<UserEntity>;
  }
}
