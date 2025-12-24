import { NotificationEntity } from '../../domain/entities/notification.entity';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';

export class NotificationResponseDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  readAt: Date | null;
  createdAt: Date;

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

  static fromEntities(entities: NotificationEntity[]): NotificationResponseDto[] {
    return entities.map((e) => NotificationResponseDto.fromEntity(e));
  }
}

