import {
  Notification,
  NotificationDelivery,
  NotificationChannel,
  NotificationDeliveryStatus,
} from '@prisma/client';
import {
  NotificationEntity,
  NotificationDelivery as DomainDelivery,
} from '../../domain/entities/notification.entity';

export class NotificationPrismaMapper {
  static toDomain(row: Notification & { deliveries: NotificationDelivery[] }): NotificationEntity {
    const deliveries: DomainDelivery[] = row.deliveries.map((d) => ({
      channel: d.channel,
      status: d.status,
      providerMessageId: d.providerMessageId,
      errorCode: d.errorCode,
      errorMessage: d.errorMessage,
      sentAt: d.sentAt,
      readAt: d.readAt,
    }));

    return new NotificationEntity(
      row.id,
      row.userId,
      row.type,
      row.title,
      row.body,
      (row.data as Record<string, any> | null) ?? null,
      row.idempotencyKey,
      row.createdAt,
      deliveries,
    );
  }

  static deliveryDefaults(channel: NotificationChannel): Pick<
    NotificationDelivery,
    'channel' | 'status' | 'providerMessageId' | 'errorCode' | 'errorMessage' | 'sentAt' | 'readAt'
  > {
    const now = new Date();
    if (channel === NotificationChannel.IN_APP) {
      return {
        channel,
        status: NotificationDeliveryStatus.SENT,
        providerMessageId: null,
        errorCode: null,
        errorMessage: null,
        sentAt: now,
        readAt: null,
      };
    }
    return {
      channel,
      status: NotificationDeliveryStatus.PENDING,
      providerMessageId: null,
      errorCode: null,
      errorMessage: null,
      sentAt: null,
      readAt: null,
    };
  }
}

