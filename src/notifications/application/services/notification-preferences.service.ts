import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  NOTIFICATION_PREFERENCES_REPOSITORY,
  NotificationPreferencesRepository,
} from '../../domain/repositories/notification-preferences.repository';
import {
  NotificationPreferencesEntity,
  NotificationTypeOverride,
} from '../../domain/entities/notification-preferences.entity';
import { ExternalNotificationChannel } from '../../domain/value-objects/external-notification-channel';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @Inject(NOTIFICATION_PREFERENCES_REPOSITORY)
    private readonly repo: NotificationPreferencesRepository,
  ) {}

  /**
   * Returns persisted preferences or defaults (not persisted).
   */
  async getForUser(userId: string): Promise<NotificationPreferencesEntity> {
    const existing = await this.repo.findByUserId(userId);
    if (existing) return existing;
    return NotificationPreferencesEntity.defaultsForUser({
      id: randomUUID(),
      userId,
    });
  }

  async upsertForUser(
    userId: string,
    input: {
      inAppEnabled?: boolean;
      externalEnabled?: boolean;
      preferredExternalChannel?: ExternalNotificationChannel;
      overrides?: Record<string, NotificationTypeOverride> | null;
    },
  ): Promise<NotificationPreferencesEntity> {
    const current = await this.getForUser(userId);
    const now = new Date();

    const next = new NotificationPreferencesEntity(
      current.id,
      userId,
      input.inAppEnabled ?? current.inAppEnabled,
      input.externalEnabled ?? current.externalEnabled,
      input.preferredExternalChannel ?? current.preferredExternalChannel,
      input.overrides !== undefined ? input.overrides : current.overrides,
      current.createdAt,
      now,
    );

    return this.repo.upsert(next);
  }
}

