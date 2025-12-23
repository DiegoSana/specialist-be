import { NotificationEntity } from '../entities/notification.entity';

export type ListUserNotificationsQuery = {
  userId: string;
  unreadOnly?: boolean;
  take?: number;
};

export interface NotificationRepository {
  findById(id: string): Promise<NotificationEntity | null>;
  findByIdempotencyKey(key: string): Promise<NotificationEntity | null>;
  listForUser(query: ListUserNotificationsQuery): Promise<NotificationEntity[]>;
  create(input: {
    notification: NotificationEntity;
    deliveryChannels: import('@prisma/client').NotificationChannel[];
    inAppReadAt?: Date | null;
    emailStatus?: 'PENDING' | 'SKIPPED';
    whatsappStatus?: 'PENDING' | 'SKIPPED';
  }): Promise<NotificationEntity>;
  markInAppRead(userId: string, notificationId: string, now: Date): Promise<NotificationEntity>;
  markAllInAppRead(userId: string, now: Date): Promise<number>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepository');

