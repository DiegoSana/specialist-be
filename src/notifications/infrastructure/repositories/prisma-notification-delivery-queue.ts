import { Injectable } from '@nestjs/common';
import {
  NotificationChannel as PrismaNotificationChannel,
  NotificationDeliveryStatus as PrismaDeliveryStatus,
} from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  NotificationDeliveryQueue,
  PendingDelivery,
} from '../../domain/ports/notification-delivery-queue';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';

@Injectable()
export class PrismaNotificationDeliveryQueue
  implements NotificationDeliveryQueue
{
  constructor(private readonly prisma: PrismaService) {}

  async takePendingDeliveries(
    channel: NotificationChannel,
    limit: number,
  ): Promise<PendingDelivery[]> {
    const take = Math.min(Math.max(limit, 1), 200);
    const prismaChannel = channel as unknown as PrismaNotificationChannel;

    const now = new Date();
    const rows = await this.prisma.notificationDelivery.findMany({
      where: {
        channel: prismaChannel,
        status: PrismaDeliveryStatus.PENDING,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take,
      include: {
        notification: {
          include: { user: true },
        },
      },
    });

    return rows.map((d) => ({
      deliveryId: d.id,
      channel: d.channel as unknown as NotificationChannel,
      attemptCount: d.attemptCount,
      nextAttemptAt: d.nextAttemptAt,
      notification: {
        id: d.notification.id,
        userId: d.notification.userId,
        userEmail: d.notification.user.email,
        type: d.notification.type,
        title: d.notification.title,
        body: d.notification.body,
        data: (d.notification.data as Record<string, any> | null) ?? null,
        createdAt: d.notification.createdAt,
      },
    }));
  }

  async markSent(
    deliveryId: string,
    sentAt: Date,
    providerMessageId?: string | null,
  ): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: PrismaDeliveryStatus.SENT,
        sentAt,
        lastAttemptAt: sentAt,
        nextAttemptAt: null,
        providerMessageId: providerMessageId ?? null,
        errorCode: null,
        errorMessage: null,
      },
    });
  }

  async markRetry(
    deliveryId: string,
    error: { code?: string | null; message: string },
    attemptedAt: Date,
    nextAttemptAt: Date,
  ): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: PrismaDeliveryStatus.PENDING,
        errorCode: error.code ?? null,
        errorMessage: error.message,
        lastAttemptAt: attemptedAt,
        nextAttemptAt,
        attemptCount: { increment: 1 },
      },
    });
  }

  async markFailedPermanently(
    deliveryId: string,
    error: { code?: string | null; message: string },
    attemptedAt: Date,
  ): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: PrismaDeliveryStatus.FAILED,
        errorCode: error.code ?? null,
        errorMessage: error.message,
        lastAttemptAt: attemptedAt,
        nextAttemptAt: null,
        attemptCount: { increment: 1 },
      },
    });
  }
}
