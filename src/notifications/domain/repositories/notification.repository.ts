import { NotificationEntity } from '../entities/notification.entity';
import { NotificationChannel } from '../value-objects/notification-channel';

export type ListUserNotificationsQuery = {
  userId: string;
  unreadOnly?: boolean;
  take?: number;
};

export type ListAllNotificationsQuery = {
  userId?: string;
  type?: string;
  unreadOnly?: boolean;
  hasFailedDelivery?: boolean;
  take?: number;
  skip?: number;
};

export type NotificationDeliveryStats = {
  total: number;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
  failedLast24h: number;
  pendingExternal: number;
};

export interface NotificationRepository {
  findById(id: string): Promise<NotificationEntity | null>;
  findByIdempotencyKey(key: string): Promise<NotificationEntity | null>;
  listForUser(query: ListUserNotificationsQuery): Promise<NotificationEntity[]>;
  create(input: {
    notification: NotificationEntity;
    deliveryChannels: NotificationChannel[];
    inAppReadAt?: Date | null;
    emailStatus?: 'PENDING' | 'SKIPPED';
    whatsappStatus?: 'PENDING' | 'SKIPPED';
  }): Promise<NotificationEntity>;
  markInAppRead(
    userId: string,
    notificationId: string,
    now: Date,
  ): Promise<NotificationEntity>;
  markAllInAppRead(userId: string, now: Date): Promise<number>;

  // Admin methods
  listAll(
    query: ListAllNotificationsQuery,
  ): Promise<{ items: NotificationEntity[]; total: number }>;
  getDeliveryStats(): Promise<NotificationDeliveryStats>;
  markForResend(notificationId: string): Promise<NotificationEntity>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepository');
