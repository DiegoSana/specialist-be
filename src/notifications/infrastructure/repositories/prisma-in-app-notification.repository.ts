import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  InAppNotificationRepository,
  ListNotificationsQuery,
} from '../../domain/repositories/in-app-notification.repository';
import { InAppNotificationEntity } from '../../domain/entities/in-app-notification.entity';
import { InAppNotificationPrismaMapper } from '../mappers/in-app-notification.prisma-mapper';

@Injectable()
export class PrismaInAppNotificationRepository
  implements InAppNotificationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(
    notification: InAppNotificationEntity,
  ): Promise<InAppNotificationEntity> {
    const created = await this.prisma.inAppNotification.create({
      data: InAppNotificationPrismaMapper.toPersistence(notification),
    });
    return InAppNotificationPrismaMapper.toDomain(created);
  }

  async findById(id: string): Promise<InAppNotificationEntity | null> {
    const row = await this.prisma.inAppNotification.findUnique({
      where: { id },
    });
    return row ? InAppNotificationPrismaMapper.toDomain(row) : null;
  }

  async list(
    query: ListNotificationsQuery,
  ): Promise<InAppNotificationEntity[]> {
    const take = Math.min(Math.max(query.take ?? 50, 1), 100);
    const rows = await this.prisma.inAppNotification.findMany({
      where: {
        userId: query.userId,
        ...(query.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map(InAppNotificationPrismaMapper.toDomain);
  }

  async save(
    notification: InAppNotificationEntity,
  ): Promise<InAppNotificationEntity> {
    const updated = await this.prisma.inAppNotification.update({
      where: { id: notification.id },
      data: {
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        readAt: notification.readAt,
      },
    });
    return InAppNotificationPrismaMapper.toDomain(updated);
  }

  async markAllRead(userId: string, now: Date): Promise<number> {
    const result = await this.prisma.inAppNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now },
    });
    return result.count;
  }
}
