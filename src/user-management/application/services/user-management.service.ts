import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { UserRepository, USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UserManagementService {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepository) {}

  async getProfile(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, updateDto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate profilePictureUrl if provided
    if (updateDto.profilePictureUrl !== undefined && updateDto.profilePictureUrl !== null && updateDto.profilePictureUrl !== '') {
      try {
        new URL(updateDto.profilePictureUrl);
      } catch {
        throw new BadRequestException('profilePictureUrl must be a valid URL');
      }
    }

    return this.userRepository.update(userId, updateDto);
  }
}

