import { NotificationPreferences } from '@prisma/client';
import { NotificationPreferencesEntity } from '../../domain/entities/notification-preferences.entity';
import { ExternalNotificationChannel } from '../../domain/value-objects/external-notification-channel';

export class NotificationPreferencesPrismaMapper {
  static toDomain(row: NotificationPreferences): NotificationPreferencesEntity {
    return new NotificationPreferencesEntity(
      row.id,
      row.userId,
      row.inAppEnabled,
      row.externalEnabled,
      row.preferredExternalChannel as unknown as ExternalNotificationChannel,
      (row.overrides as Record<string, any> | null) ?? null,
      row.createdAt,
      row.updatedAt,
    );
  }

  static toCreateInput(entity: NotificationPreferencesEntity) {
    return {
      id: entity.id,
      userId: entity.userId,
      inAppEnabled: entity.inAppEnabled,
      externalEnabled: entity.externalEnabled,
      preferredExternalChannel: entity.preferredExternalChannel as any,
      overrides: entity.overrides,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

