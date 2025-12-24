import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class NotificationRetentionJob {
  private readonly logger = new Logger(NotificationRetentionJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Deletes notifications older than N days (default: 90).
   * Runs daily at 03:15 server time.
   *
   * Note: cascade deletes `notification_deliveries`.
   */
  @Cron('15 3 * * *')
  async run(): Promise<void> {
    const days = Number(
      this.config.get<string>('NOTIFICATIONS_RETENTION_DAYS', '90'),
    );
    const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 90;

    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (result.count > 0) {
      this.logger.log(
        `Deleted ${result.count} notifications older than ${safeDays} days.`,
      );
    }
  }
}
