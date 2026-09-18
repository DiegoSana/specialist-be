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
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import { UserWhatsAppOptedOutEvent } from '../../domain/events/user-whatsapp-opted-out.event';
import { UserWhatsAppReactivatedEvent } from '../../domain/events/user-whatsapp-reactivated.event';

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
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
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
   * Set (or clear) the WhatsApp opt-out flag. Two callers funnel through here: the WhatsApp
   * reply classifier (when a user asks to stop receiving messages) and the admin manual
   * override (UserService.updateWhatsAppOptOutForUser) — see ProfileActivationService, which
   * treats an opted-out user as having no active profile (WhatsApp is the mandatory
   * channel for coordinating requests).
   *
   * Publishes UserWhatsAppOptedOutEvent on the false -> true transition and
   * UserWhatsAppReactivatedEvent on the true -> false transition (never both, never when the
   * value doesn't actually change), so the user is told exactly once per transition, regardless
   * of which caller triggered it.
   */
  async setWhatsAppOptedOut(
    userId: string,
    optedOut: boolean,
  ): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const wasOptedOut = user.whatsappOptedOut;
    const saved = await this.userRepository.save(
      user.withWhatsAppOptedOut(optedOut),
    );
    if (optedOut && !wasOptedOut) {
      await this.eventBus.publish(
        new UserWhatsAppOptedOutEvent({ userId: saved.id }),
      );
    } else if (!optedOut && wasOptedOut) {
      await this.eventBus.publish(
        new UserWhatsAppReactivatedEvent({ userId: saved.id }),
      );
    }
    return saved;
  }

  /**
   * IDs of all admin users. Used to fan out admin notifications without a fixed,
   * hardcoded admin user id.
   */
  async findAdminUserIds(): Promise<string[]> {
    return this.userQueryRepository.findAdminUserIds();
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

  /**
   * Admin only: set email and/or phone verification (manual confirmation).
   */
  async updateVerificationForUser(
    targetUserId: string,
    actingUser: UserEntity,
    overrides: { emailVerified?: boolean; phoneVerified?: boolean },
  ): Promise<UserEntity> {
    if (!actingUser.isAdminUser()) {
      throw new ForbiddenException(
        'Only admins can update verification status',
      );
    }
    const targetUser = await this.userRepository.findById(targetUserId, true);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    if (
      overrides.emailVerified === undefined &&
      overrides.phoneVerified === undefined
    ) {
      return targetUser;
    }
    const next = targetUser.withVerificationOverrides(overrides);
    return this.userRepository.save(next);
  }

  /**
   * Admin only: manually set/clear a user's WhatsApp opt-out flag. No-op (and skips the
   * notification event) when the flag already matches the requested value, so an admin
   * re-saving the same state never re-triggers the "you were opted out"/"you're reactivated"
   * notification. Delegates the actual persistence + transition-detection to
   * setWhatsAppOptedOut, the same method the automatic WhatsApp reply classifier uses.
   */
  async updateWhatsAppOptOutForUser(
    targetUserId: string,
    actingUser: UserEntity,
    optedOut: boolean,
  ): Promise<UserEntity> {
    if (!actingUser.isAdminUser()) {
      throw new ForbiddenException(
        'Only admins can update the WhatsApp opt-out flag',
      );
    }
    const targetUser = await this.userRepository.findById(targetUserId, true);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    if (targetUser.whatsappOptedOut === optedOut) {
      return targetUser;
    }
    return this.setWhatsAppOptedOut(targetUserId, optedOut);
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
  async getAllUsersForAdmin(
    page: number = 1,
    limit: number = 10,
    search?: string,
    type?: 'CLIENT' | 'PROFESSIONAL' | 'COMPANY',
  ) {
    const skip = (page - 1) * limit;
    const { users, total } = await this.userQueryRepository.findAllForAdmin({
      skip,
      take: limit,
      search,
      type,
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
