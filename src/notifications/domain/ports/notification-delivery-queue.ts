import { NotificationChannel } from '../value-objects/notification-channel';

export type PendingDelivery = {
  deliveryId: string;
  channel: NotificationChannel;
  attemptCount: number;
  nextAttemptAt: Date | null;
  notification: {
    id: string;
    userId: string;
    userEmail: string;
    type: string;
    title: string;
    body: string | null;
    data: Record<string, any> | null;
    createdAt: Date;
  };
};

export interface NotificationDeliveryQueue {
  takePendingDeliveries(
    channel: NotificationChannel,
    limit: number,
  ): Promise<PendingDelivery[]>;

  markSent(
    deliveryId: string,
    sentAt: Date,
    providerMessageId?: string | null,
  ): Promise<void>;

  markRetry(
    deliveryId: string,
    error: { code?: string | null; message: string },
    attemptedAt: Date,
    nextAttemptAt: Date,
  ): Promise<void>;

  markFailedPermanently(
    deliveryId: string,
    error: { code?: string | null; message: string },
    attemptedAt: Date,
  ): Promise<void>;
}

export const NOTIFICATION_DELIVERY_QUEUE = Symbol('NotificationDeliveryQueue');
