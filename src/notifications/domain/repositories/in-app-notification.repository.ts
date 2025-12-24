import { InAppNotificationEntity } from '../entities/in-app-notification.entity';

export type ListNotificationsQuery = {
  userId: string;
  unreadOnly?: boolean;
  take?: number;
};

export interface InAppNotificationRepository {
  create(
    notification: InAppNotificationEntity,
  ): Promise<InAppNotificationEntity>;
  findById(id: string): Promise<InAppNotificationEntity | null>;
  list(query: ListNotificationsQuery): Promise<InAppNotificationEntity[]>;
  save(notification: InAppNotificationEntity): Promise<InAppNotificationEntity>;
  markAllRead(userId: string, now: Date): Promise<number>;
}

export const IN_APP_NOTIFICATION_REPOSITORY = Symbol(
  'InAppNotificationRepository',
);
