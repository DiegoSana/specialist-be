import {
  NotificationDelivery,
  NotificationEntity,
} from '../../domain/entities/notification.entity';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';
import { NotificationDeliveryStatus } from '../../domain/value-objects/notification-delivery-status';

export class NotificationDeliveryDto {
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: Date | null;

  static fromDelivery(delivery: NotificationDelivery): NotificationDeliveryDto {
    const dto = new NotificationDeliveryDto();
    dto.channel = delivery.channel;
    dto.status = delivery.status;
    dto.providerMessageId = delivery.providerMessageId;
    dto.errorMessage = delivery.errorMessage;
    dto.sentAt = delivery.sentAt;
    return dto;
  }
}

export class NotificationResponseDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  readAt: Date | null;
  createdAt: Date;
  // Only populated by fromEntityForAdmin - regular users never see delivery/provider internals.
  deliveries?: NotificationDeliveryDto[];

  static fromEntity(entity: NotificationEntity): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.type = entity.type;
    dto.title = entity.title;
    dto.body = entity.body;
    dto.data = entity.data;
    dto.createdAt = entity.createdAt;
    // Extract readAt from IN_APP delivery
    dto.readAt =
      entity.deliveries.find((d) => d.channel === NotificationChannel.IN_APP)
        ?.readAt ?? null;
    return dto;
  }

  static fromEntities(
    entities: NotificationEntity[],
  ): NotificationResponseDto[] {
    return entities.map((e) => NotificationResponseDto.fromEntity(e));
  }

  static fromEntityForAdmin(
    entity: NotificationEntity,
  ): NotificationResponseDto {
    const dto = NotificationResponseDto.fromEntity(entity);
    dto.deliveries = entity.deliveries.map(
      NotificationDeliveryDto.fromDelivery,
    );
    return dto;
  }

  static fromEntitiesForAdmin(
    entities: NotificationEntity[],
  ): NotificationResponseDto[] {
    return entities.map((e) => NotificationResponseDto.fromEntityForAdmin(e));
  }
}
