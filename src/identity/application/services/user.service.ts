import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import {
  UserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository';
import {
  UserQueryRepository,
  USER_QUERY_REPOSITORY,
} from '../../domain/queries/user.query-repository';
import { UserEntity, UserAuthContext } from '../../domain/entities/user.entity';

/**
 * UserService exposes user operations to other bounded contexts.
 * This follows DDD principles - other contexts should use this service
 * instead of directly accessing the UserRepository.
 */
@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_QUERY_REPOSITORY)
    private readonly userQueryRepository: UserQueryRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Auth Context Helper
  // ─────────────────────────────────────────────────────────────

  private buildAuthContext(actingUser: UserEntity): UserAuthContext {
    return UserEntity.buildAuthContext(actingUser.id, actingUser.isAdminUser());
  }

  /**
   * Find user by ID
   * @param userId - User ID
   * @param includeProfiles - Whether to include client/professional profile info
   * @returns User entity or null
   */
  async findById(
    userId: string,
    includeProfiles = false,
  ): Promise<UserEntity | null> {
    return this.userRepository.findById(userId, includeProfiles);
  }

  /**
   * Find user by ID or throw NotFoundException
   * @param userId - User ID
   * @param includeProfiles - Whether to include client/professional profile info
   * @returns User entity
   * @throws NotFoundException if user not found
   */
  async findByIdOrFail(
    userId: string,
    includeProfiles = false,
  ): Promise<UserEntity> {
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
  async findByEmail(
    email: string,
    includeProfiles = false,
  ): Promise<UserEntity | null> {
    return this.userRepository.findByEmail(email, includeProfiles);
  }

  /**
   * Update user data
   * @param userId - User ID
   * @param data - Partial user data to update
   * @returns Updated user entity
   */
  async update(userId: string, data: Partial<UserEntity>): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Apply supported mutations via domain methods (immutability)
    let next = user;

    if (data.status !== undefined && data.status !== null) {
      next = next.withStatus(data.status as any);
    }

    const hasProfileUpdate =
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.phone !== undefined ||
      (data as any).profilePictureUrl !== undefined;

    if (hasProfileUpdate) {
      next = next.withUpdatedProfile({
        firstName: data.firstName ?? user.firstName,
        lastName: data.lastName ?? user.lastName,
        phone: data.phone ?? user.phone,
        profilePictureUrl:
          (data as any).profilePictureUrl ?? user.profilePictureUrl,
        now: new Date(),
      });
    }

    return this.userRepository.save(next);
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

  // ─────────────────────────────────────────────────────────────
  // Permission-aware methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Find user by ID with permission check.
   * @param targetUserId - User ID to find
   * @param actingUser - User performing the action
   * @returns User entity
   * @throws ForbiddenException if not authorized
   */
  async findByIdForUser(
    targetUserId: string,
    actingUser: UserEntity,
  ): Promise<UserEntity> {
    const ctx = this.buildAuthContext(actingUser);
    const targetUser = await this.userRepository.findById(targetUserId, true);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (!targetUser.canBeViewedBy(ctx)) {
      throw new ForbiddenException('Cannot view this user');
    }

    return targetUser;
  }

  /**
   * Update user profile with permission check.
   * @param targetUserId - User ID to update
   * @param actingUser - User performing the action
   * @param data - Data to update
   * @returns Updated user entity
   * @throws ForbiddenException if not authorized
   */
  async updateForUser(
    targetUserId: string,
    actingUser: UserEntity,
    data: Partial<UserEntity>,
  ): Promise<UserEntity> {
    const ctx = this.buildAuthContext(actingUser);
    const targetUser = await this.userRepository.findById(targetUserId, true);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (!targetUser.canBeEditedBy(ctx)) {
      throw new ForbiddenException('Cannot edit this user');
    }

    // Apply supported mutations via domain methods (immutability)
    let next = targetUser;

    const hasProfileUpdate =
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.phone !== undefined ||
      (data as any).profilePictureUrl !== undefined;

    if (hasProfileUpdate) {
      next = next.withUpdatedProfile({
        firstName: data.firstName ?? targetUser.firstName,
        lastName: data.lastName ?? targetUser.lastName,
        phone: data.phone ?? targetUser.phone,
        profilePictureUrl:
          (data as any).profilePictureUrl ?? targetUser.profilePictureUrl,
        now: new Date(),
      });
    }

    return this.userRepository.save(next);
  }

  /**
   * Update user status with permission check.
   * @param targetUserId - User ID to update
   * @param actingUser - User performing the action
   * @param status - New status
   * @returns Updated user entity
   * @throws ForbiddenException if not authorized (only admins)
   */
  async updateStatusForUser(
    targetUserId: string,
    actingUser: UserEntity,
    status: any,
  ): Promise<UserEntity> {
    const ctx = this.buildAuthContext(actingUser);
    const targetUser = await this.userRepository.findById(targetUserId, true);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (!targetUser.canChangeStatusBy(ctx)) {
      throw new ForbiddenException('Only admins can change user status');
    }

    const next = targetUser.withStatus(status);
    return this.userRepository.save(next);
  }

  // ─────────────────────────────────────────────────────────────
  // Statistics methods (for admin dashboard)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get user statistics for admin dashboard
   * @returns User statistics
   */
  async getUserStats() {
    return this.userQueryRepository.getUserStats();
  }

  /**
   * Get all users for admin (paginated)
   */
  async getAllUsersForAdmin(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const { users, total } = await this.userQueryRepository.findAllForAdmin({
      skip,
      take: limit,
    });

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
}
