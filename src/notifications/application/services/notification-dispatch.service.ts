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

    const maxAttempts = Number(
      this.config.get<string>('NOTIFICATIONS_DISPATCH_MAX_ATTEMPTS', '5'),
    );
    const safeMaxAttempts =
      Number.isFinite(maxAttempts) && maxAttempts > 0 ? Math.floor(maxAttempts) : 5;

    const baseSeconds = Number(
      this.config.get<string>('NOTIFICATIONS_DISPATCH_RETRY_BASE_SECONDS', '60'),
    );
    const safeBaseSeconds =
      Number.isFinite(baseSeconds) && baseSeconds > 0 ? Math.floor(baseSeconds) : 60;

    const maxBackoffSeconds = Number(
      this.config.get<string>('NOTIFICATIONS_DISPATCH_RETRY_MAX_SECONDS', '3600'),
    );
    const safeMaxBackoffSeconds =
      Number.isFinite(maxBackoffSeconds) && maxBackoffSeconds > 0
        ? Math.floor(maxBackoffSeconds)
        : 3600;

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
        const attemptedAt = new Date();
        const message =
          typeof err?.message === 'string' ? err.message : 'Failed to send email';
        const code = typeof err?.code === 'string' ? err.code : null;

        const nextAttemptNumber = item.attemptCount + 1; // about to record this failure
        if (nextAttemptNumber >= safeMaxAttempts) {
          this.logger.warn(
            `Email delivery failed permanently (deliveryId=${item.deliveryId}, attempts=${nextAttemptNumber}/${safeMaxAttempts}): ${message}`,
          );
          await this.queue.markFailedPermanently(
            item.deliveryId,
            { code, message },
            attemptedAt,
          );
          continue;
        }

        const delaySeconds = this.computeBackoffSeconds(
          nextAttemptNumber,
          safeBaseSeconds,
          safeMaxBackoffSeconds,
        );
        const nextAttemptAt = new Date(attemptedAt.getTime() + delaySeconds * 1000);

        this.logger.warn(
          `Email delivery failed (deliveryId=${item.deliveryId}, attempts=${nextAttemptNumber}/${safeMaxAttempts}). Retrying in ${delaySeconds}s: ${message}`,
        );

        await this.queue.markRetry(
          item.deliveryId,
          { code, message },
          attemptedAt,
          nextAttemptAt,
        );
      }
    }
  }

  private computeBackoffSeconds(
    attemptNumber: number,
    baseSeconds: number,
    maxSeconds: number,
  ): number {
    // attemptNumber starts at 1
    const exp = Math.min(attemptNumber - 1, 20);
    const raw = Math.min(baseSeconds * Math.pow(2, exp), maxSeconds);
    // jitter: 0%..20%
    const jitter = raw * (Math.random() * 0.2);
    return Math.max(1, Math.floor(raw + jitter));
  }
}

