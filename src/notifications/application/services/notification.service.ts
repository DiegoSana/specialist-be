import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../domain/repositories/notification.repository';
import { NotificationPreferencesService } from './notification-preferences.service';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: NotificationRepository,
    private readonly preferences: NotificationPreferencesService,
  ) {}

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

    const channels: NotificationChannel[] = [NotificationChannel.IN_APP];

    let externalChannel: NotificationChannel | null = null;
    const wantsExternal = input.includeExternal !== false;
    const shouldCreateExternal =
      wantsExternal && (effective.externalEnabled || input.requireExternal === true);

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
        externalChannel === NotificationChannel.WHATSAPP ? 'PENDING' : 'SKIPPED',
    });
  }

  async listForUser(userId: string, query?: { unreadOnly?: boolean; take?: number }) {
    return this.repo.listForUser({
      userId,
      unreadOnly: query?.unreadOnly,
      take: query?.take,
    });
  }

  async markRead(userId: string, notificationId: string) {
    // Repository enforces ownership; keep explicit check for clarity.
    const existing = await this.repo.findById(notificationId);
    if (!existing) throw new NotFoundException('Notification not found');
    if (existing.userId !== userId) throw new ForbiddenException();
    return this.repo.markInAppRead(userId, notificationId, new Date());
  }

  async markAllRead(userId: string) {
    const count = await this.repo.markAllInAppRead(userId, new Date());
    return { updated: count };
  }
}

