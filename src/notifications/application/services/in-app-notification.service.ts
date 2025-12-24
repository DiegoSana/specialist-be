import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  IN_APP_NOTIFICATION_REPOSITORY,
  InAppNotificationRepository,
} from '../../domain/repositories/in-app-notification.repository';
import { InAppNotificationEntity } from '../../domain/entities/in-app-notification.entity';

@Injectable()
export class InAppNotificationService {
  constructor(
    @Inject(IN_APP_NOTIFICATION_REPOSITORY)
    private readonly repo: InAppNotificationRepository,
  ) {}

  async createForUser(input: {
    userId: string;
    type: string;
    title: string;
    body?: string | null;
    data?: Record<string, any> | null;
  }): Promise<InAppNotificationEntity> {
    return this.repo.create(
      InAppNotificationEntity.create({
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: input.data ?? null,
      }),
    );
  }

  async listForUser(
    userId: string,
    query?: { unreadOnly?: boolean; take?: number },
  ) {
    return this.repo.list({
      userId,
      unreadOnly: query?.unreadOnly,
      take: query?.take,
    });
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.repo.findById(notificationId);
    if (!existing) throw new NotFoundException('Notification not found');
    if (existing.userId !== userId) throw new ForbiddenException();
    return this.repo.save(existing.markRead());
  }

  async markAllRead(userId: string) {
    const count = await this.repo.markAllRead(userId, new Date());
    return { updated: count };
  }
}
