import { NotificationChannel } from '../value-objects/notification-channel';
import { NotificationDeliveryStatus } from '../value-objects/notification-delivery-status';

export type NotificationDelivery = {
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  readAt: Date | null;
};

export class NotificationEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly title: string,
    public readonly body: string | null,
    public readonly data: Record<string, any> | null,
    public readonly idempotencyKey: string | null,
    public readonly createdAt: Date,
    public readonly deliveries: NotificationDelivery[],
  ) {}

  inAppReadAt(): Date | null {
    return (
      this.deliveries.find((d) => d.channel === NotificationChannel.IN_APP)
        ?.readAt ?? null
    );
  }
}
