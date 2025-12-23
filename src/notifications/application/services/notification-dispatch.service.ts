import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SENDER, EmailSender } from '../../domain/ports/email-sender';
import {
  NOTIFICATION_DELIVERY_QUEUE,
  NotificationDeliveryQueue,
} from '../../domain/ports/notification-delivery-queue';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @Inject(NOTIFICATION_DELIVERY_QUEUE)
    private readonly queue: NotificationDeliveryQueue,
  ) {}

  async dispatchPending(): Promise<void> {
    const enabled =
      this.config.get<string>('NOTIFICATIONS_DISPATCH_ENABLED', 'false') === 'true';
    if (!enabled) return;

    await this.dispatchEmailPending();
    // WhatsApp pending dispatch comes later.
  }

  private async dispatchEmailPending(): Promise<void> {
    // If SMTP isn't configured yet, skip silently (keep deliveries as PENDING).
    const smtpHost = this.config.get<string>('NOTIFICATIONS_SMTP_HOST');
    const smtpUser = this.config.get<string>('NOTIFICATIONS_SMTP_USER');
    const smtpFrom = this.config.get<string>('NOTIFICATIONS_SMTP_FROM');
    if (!smtpHost || !smtpUser || !smtpFrom) return;

    const batchSize = Number(
      this.config.get<string>('NOTIFICATIONS_DISPATCH_BATCH_SIZE', '25'),
    );
    const limit = Number.isFinite(batchSize) ? Math.max(1, Math.floor(batchSize)) : 25;

    const pending = await this.queue.takePendingDeliveries(
      NotificationChannel.EMAIL,
      limit,
    );
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        const subject = item.notification.title;
        const text = item.notification.body ?? '';

        await this.emailSender.send({
          to: item.notification.userEmail,
          subject,
          text,
        });

        await this.queue.markSent(item.deliveryId, new Date(), null);
      } catch (err: any) {
        const message =
          typeof err?.message === 'string' ? err.message : 'Failed to send email';
        const code = typeof err?.code === 'string' ? err.code : null;

        this.logger.warn(
          `Email delivery failed (deliveryId=${item.deliveryId}): ${message}`,
        );

        await this.queue.markFailed(
          item.deliveryId,
          { code, message },
          new Date(),
        );
      }
    }
  }
}

