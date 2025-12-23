import {
  Notification,
  NotificationDelivery,
  NotificationChannel as PrismaNotificationChannel,
  NotificationDeliveryStatus as PrismaDeliveryStatus,
} from '@prisma/client';
import {
  NotificationEntity,
  NotificationDelivery as DomainDelivery,
} from '../../domain/entities/notification.entity';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';
import { NotificationDeliveryStatus } from '../../domain/value-objects/notification-delivery-status';

export class NotificationPrismaMapper {
  static toDomain(row: Notification & { deliveries: NotificationDelivery[] }): NotificationEntity {
    const deliveries: DomainDelivery[] = row.deliveries.map((d) => ({
      channel: d.channel as unknown as NotificationChannel,
      status: d.status as unknown as NotificationDeliveryStatus,
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
    const prismaChannel = channel as unknown as PrismaNotificationChannel;
    if (channel === NotificationChannel.IN_APP) {
      return {
        channel: prismaChannel,
        status: PrismaDeliveryStatus.SENT,
        providerMessageId: null,
        errorCode: null,
        errorMessage: null,
        sentAt: now,
        readAt: null,
      };
    }
    return {
      channel: prismaChannel,
      status: PrismaDeliveryStatus.PENDING,
      providerMessageId: null,
      errorCode: null,
      errorMessage: null,
      sentAt: null,
      readAt: null,
    };
  }
}

