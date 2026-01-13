import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  NotificationEntity,
  NotificationAuthContext,
} from '../../domain/entities/notification.entity';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../domain/repositories/notification.repository';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';
import { UserEntity } from '../../../identity/domain/entities/user.entity';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: NotificationRepository,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Auth Context Helper
  // ─────────────────────────────────────────────────────────────

  private buildAuthContext(user: UserEntity): NotificationAuthContext {
    return NotificationEntity.buildAuthContext(user.id, user.isAdminUser());
  }

  async createForUser(input: {
    userId: string;
    type: string;
    title: string;
    body?: string | null;
    data?: Record<string, any> | null;
    idempotencyKey?: string;
    /**
     * If true, creates an external delivery attempt (email/whatsapp) according to preferences.
     * If false, only in-app delivery is created.
     */
    includeExternal?: boolean;
    /**
     * If true, external delivery is created even if user disabled external notifications.
     * Useful for "must-not-miss" product notifications.
     */
    requireExternal?: boolean;
  }): Promise<NotificationEntity> {
    const now = new Date();
    const prefs = await this.preferences.getForUser(input.userId);
    const effective = prefs.effectiveFor(input.type);

    const channels: NotificationChannel[] = [];
    if (effective.inAppEnabled) {
      channels.push(NotificationChannel.IN_APP);
    }

    let externalChannel: NotificationChannel | null = null;
    const wantsExternal = input.includeExternal !== false;
    const shouldCreateExternal =
      wantsExternal &&
      (effective.externalEnabled || input.requireExternal === true);

    if (shouldCreateExternal) {
      externalChannel =
        effective.preferredExternalChannel === 'WHATSAPP'
          ? NotificationChannel.WHATSAPP
          : NotificationChannel.EMAIL;
      channels.push(externalChannel);
    }

    return this.repo.create({
      notification: new NotificationEntity(
        randomUUID(),
        input.userId,
        input.type,
        input.title,
        input.body ?? null,
        input.data ?? null,
        input.idempotencyKey ?? null,
        now,
        [],
      ),
      deliveryChannels: channels,
      emailStatus:
        externalChannel === NotificationChannel.EMAIL ? 'PENDING' : 'SKIPPED',
      whatsappStatus:
        externalChannel === NotificationChannel.WHATSAPP
          ? 'PENDING'
          : 'SKIPPED',
    });
  }

  async listForUser(
    userId: string,
    query?: { unreadOnly?: boolean; take?: number },
  ) {
    return this.repo.listForUser({
      userId,
      unreadOnly: query?.unreadOnly,
      take: query?.take,
    });
  }

  async markRead(user: UserEntity, notificationId: string) {
    const ctx = this.buildAuthContext(user);
    const existing = await this.repo.findById(notificationId);

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (!existing.canBeMarkedReadBy(ctx)) {
      throw new ForbiddenException('Cannot mark this notification as read');
    }

    return this.repo.markInAppRead(user.id, notificationId, new Date());
  }

  async markAllRead(userId: string) {
    const count = await this.repo.markAllInAppRead(userId, new Date());
    return { updated: count };
  }

  // ─────────────────────────────────────────────────────────────
  // Admin Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Find a notification by ID with permission check.
   * Admins can view any notification, users can only view their own.
   */
  async findByIdForUser(
    notificationId: string,
    user: UserEntity,
  ): Promise<NotificationEntity> {
    const ctx = this.buildAuthContext(user);
    const notification = await this.repo.findById(notificationId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.canBeViewedBy(ctx)) {
      throw new ForbiddenException('Cannot view this notification');
    }

    return notification;
  }

  /**
   * List all notifications (admin only).
   * Supports filtering by userId, type, status, and date range.
   */
  async listAll(query: {
    userId?: string;
    type?: string;
    unreadOnly?: boolean;
    hasFailedDelivery?: boolean;
    take?: number;
    skip?: number;
  }): Promise<{ items: NotificationEntity[]; total: number }> {
    return this.repo.listAll(query);
  }

  /**
   * Get notification delivery statistics (admin only).
   */
  async getDeliveryStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byChannel: Record<string, number>;
    failedLast24h: number;
    pendingExternal: number;
  }> {
    return this.repo.getDeliveryStats();
  }

  /**
   * Resend a failed external notification (admin only).
   */
  async resendNotification(
    notificationId: string,
    user: UserEntity,
  ): Promise<NotificationEntity> {
    const ctx = this.buildAuthContext(user);
    const notification = await this.repo.findById(notificationId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.canBeResentBy(ctx)) {
      throw new ForbiddenException(
        'Cannot resend this notification. Must be admin and notification must have failed/pending external delivery.',
      );
    }

    // Mark external deliveries as pending for retry
    return this.repo.markForResend(notificationId);
  }
}
