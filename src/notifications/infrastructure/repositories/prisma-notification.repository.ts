import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationChannel as PrismaNotificationChannel,
  NotificationDeliveryStatus as PrismaDeliveryStatus,
} from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  ListUserNotificationsQuery,
  NotificationRepository,
} from '../../domain/repositories/notification.repository';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { NotificationPrismaMapper } from '../mappers/notification.prisma-mapper';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<NotificationEntity | null> {
    const row = await this.prisma.notification.findUnique({
      where: { id },
      include: { deliveries: true },
    });
    return row ? NotificationPrismaMapper.toDomain(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<NotificationEntity | null> {
    const row = await this.prisma.notification.findUnique({
      where: { idempotencyKey: key },
      include: { deliveries: true },
    });
    return row ? NotificationPrismaMapper.toDomain(row) : null;
  }

  async listForUser(
    query: ListUserNotificationsQuery,
  ): Promise<NotificationEntity[]> {
    const take = Math.min(Math.max(query.take ?? 50, 1), 100);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId: query.userId,
        ...(query.unreadOnly
          ? {
              deliveries: {
                some: { channel: PrismaNotificationChannel.IN_APP, readAt: null },
              },
            }
          : {}),
      },
      include: { deliveries: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map(NotificationPrismaMapper.toDomain);
  }

  async create(input: {
    notification: NotificationEntity;
    deliveryChannels: NotificationChannel[];
    inAppReadAt?: Date | null;
    emailStatus?: 'PENDING' | 'SKIPPED';
    whatsappStatus?: 'PENDING' | 'SKIPPED';
  }): Promise<NotificationEntity> {
    const channels = Array.from(new Set(input.deliveryChannels));
    try {
      const created = await this.prisma.notification.create({
        data: {
          id: input.notification.id,
          userId: input.notification.userId,
          type: input.notification.type,
          title: input.notification.title,
          body: input.notification.body,
          data: input.notification.data,
          idempotencyKey: input.notification.idempotencyKey,
          createdAt: input.notification.createdAt,
          deliveries: {
            create: channels.map((channel) => {
              const base = NotificationPrismaMapper.deliveryDefaults(channel);

              if (channel === NotificationChannel.IN_APP) {
                return { ...base, readAt: input.inAppReadAt ?? null };
              }
              if (channel === NotificationChannel.EMAIL) {
                return {
                  ...base,
                  status:
                    input.emailStatus === 'SKIPPED'
                      ? PrismaDeliveryStatus.SKIPPED
                      : base.status,
                };
              }
              if (channel === NotificationChannel.WHATSAPP) {
                return {
                  ...base,
                  status:
                    input.whatsappStatus === 'SKIPPED'
                      ? PrismaDeliveryStatus.SKIPPED
                      : base.status,
                };
              }
              return base;
            }),
          },
        },
        include: { deliveries: true },
      });
      return NotificationPrismaMapper.toDomain(created);
    } catch (err: any) {
      // Idempotency: if we tried to create the same notification twice, return the existing one.
      if (
        input.notification.idempotencyKey &&
        err?.code === 'P2002' &&
        Array.isArray(err?.meta?.target) &&
        err.meta.target.includes('idempotencyKey')
      ) {
        const existing = await this.findByIdempotencyKey(
          input.notification.idempotencyKey,
        );
        if (existing) return existing;
      }
      throw err;
    }
  }

  async markInAppRead(
    userId: string,
    notificationId: string,
    now: Date,
  ): Promise<NotificationEntity> {
    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { deliveries: true },
    });
    if (!existing) throw new NotFoundException('Notification not found');
    if (existing.userId !== userId) throw new ForbiddenException();

    await this.prisma.notificationDelivery.update({
      where: {
        notificationId_channel: {
          notificationId,
          channel: PrismaNotificationChannel.IN_APP,
        },
      },
      data: { readAt: now },
    });

    const updated = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { deliveries: true },
    });
    // updated can't be null since it existed
    return NotificationPrismaMapper.toDomain(updated!);
  }

  async markAllInAppRead(userId: string, now: Date): Promise<number> {
    const result = await this.prisma.notificationDelivery.updateMany({
      where: {
        channel: PrismaNotificationChannel.IN_APP,
        readAt: null,
        notification: { userId },
      },
      data: { readAt: now },
    });
    return result.count;
  }
}

