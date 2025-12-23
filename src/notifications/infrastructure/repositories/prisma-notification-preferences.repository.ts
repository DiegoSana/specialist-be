import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { NotificationPreferencesRepository } from '../../domain/repositories/notification-preferences.repository';
import { NotificationPreferencesEntity } from '../../domain/entities/notification-preferences.entity';
import { NotificationPreferencesPrismaMapper } from '../mappers/notification-preferences.prisma-mapper';

@Injectable()
export class PrismaNotificationPreferencesRepository
  implements NotificationPreferencesRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(
    userId: string,
  ): Promise<NotificationPreferencesEntity | null> {
    const row = await this.prisma.notificationPreferences.findUnique({
      where: { userId },
    });
    return row ? NotificationPreferencesPrismaMapper.toDomain(row) : null;
  }

  async upsert(
    preferences: NotificationPreferencesEntity,
  ): Promise<NotificationPreferencesEntity> {
    const row = await this.prisma.notificationPreferences.upsert({
      where: { userId: preferences.userId },
      create: NotificationPreferencesPrismaMapper.toCreateInput(preferences),
      update: {
        inAppEnabled: preferences.inAppEnabled,
        externalEnabled: preferences.externalEnabled,
        preferredExternalChannel: preferences.preferredExternalChannel,
        overrides: preferences.overrides,
      },
    });
    return NotificationPreferencesPrismaMapper.toDomain(row);
  }
}

