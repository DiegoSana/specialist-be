import { NotificationPreferencesEntity } from '../entities/notification-preferences.entity';

export interface NotificationPreferencesRepository {
  findByUserId(userId: string): Promise<NotificationPreferencesEntity | null>;
  upsert(preferences: NotificationPreferencesEntity): Promise<NotificationPreferencesEntity>;
}

export const NOTIFICATION_PREFERENCES_REPOSITORY = Symbol(
  'NotificationPreferencesRepository',
);

