import { InAppNotification } from '@prisma/client';
import { InAppNotificationEntity } from '../../domain/entities/in-app-notification.entity';

export class InAppNotificationPrismaMapper {
  static toDomain(row: InAppNotification): InAppNotificationEntity {
    return new InAppNotificationEntity(
      row.id,
      row.userId,
      row.type,
      row.title,
      row.body,
      (row.data as Record<string, any> | null) ?? null,
      row.readAt,
      row.createdAt,
    );
  }

  static toPersistence(
    entity: InAppNotificationEntity,
  ): Omit<InAppNotification, 'createdAt'> & { createdAt?: Date } {
    return {
      id: entity.id,
      userId: entity.userId,
      type: entity.type,
      title: entity.title,
      body: entity.body,
      data: entity.data,
      readAt: entity.readAt,
      createdAt: entity.createdAt,
    };
  }
}
