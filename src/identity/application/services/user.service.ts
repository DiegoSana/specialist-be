import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { UserRepository, USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { UserEntity } from '../../domain/entities/user.entity';

/**
 * UserService exposes user operations to other bounded contexts.
 * This follows DDD principles - other contexts should use this service
 * instead of directly accessing the UserRepository.
 */
@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  /**
   * Find user by ID
   * @param userId - User ID
   * @param includeProfiles - Whether to include client/professional profile info
   * @returns User entity or null
   */
  async findById(userId: string, includeProfiles = false): Promise<UserEntity | null> {
    return this.userRepository.findById(userId, includeProfiles);
  }

  /**
   * Find user by ID or throw NotFoundException
   * @param userId - User ID
   * @param includeProfiles - Whether to include client/professional profile info
   * @returns User entity
   * @throws NotFoundException if user not found
   */
  async findByIdOrFail(userId: string, includeProfiles = false): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId, includeProfiles);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Find user by email
   * @param email - User email
   * @param includeProfiles - Whether to include client/professional profile info
   * @returns User entity or null
   */
  async findByEmail(email: string, includeProfiles = false): Promise<UserEntity | null> {
    return this.userRepository.findByEmail(email, includeProfiles);
  }

  /**
   * Update user data
   * @param userId - User ID
   * @param data - Partial user data to update
   * @returns Updated user entity
   */
  async update(userId: string, data: Partial<UserEntity>): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.userRepository.update(userId, data);
  }

  /**
   * Check if user exists
   * @param userId - User ID
   * @returns boolean
   */
  async exists(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    return !!user;
  }
}

