import { NotificationChannel } from '../value-objects/notification-channel';
import { NotificationDeliveryStatus } from '../value-objects/notification-delivery-status';

export type NotificationDelivery = {
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  readAt: Date | null;
};

/**
 * Authorization context for notification operations.
 */
export interface NotificationAuthContext {
  userId: string;
  isAdmin: boolean;
}

export class NotificationEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly title: string,
    public readonly body: string | null,
    public readonly data: Record<string, any> | null,
    public readonly idempotencyKey: string | null,
    public readonly createdAt: Date,
    public readonly deliveries: NotificationDelivery[],
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────

  inAppReadAt(): Date | null {
    return (
      this.deliveries.find((d) => d.channel === NotificationChannel.IN_APP)
        ?.readAt ?? null
    );
  }

  isRead(): boolean {
    return this.inAppReadAt() !== null;
  }

  getDeliveryByChannel(channel: NotificationChannel): NotificationDelivery | undefined {
    return this.deliveries.find((d) => d.channel === channel);
  }

  hasFailedDelivery(): boolean {
    return this.deliveries.some((d) => d.status === NotificationDeliveryStatus.FAILED);
  }

  hasPendingExternalDelivery(): boolean {
    return this.deliveries.some(
      (d) =>
        d.channel !== NotificationChannel.IN_APP &&
        d.status === NotificationDeliveryStatus.PENDING,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Authorization Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if user can view this notification.
   * - Owner can always view their notifications
   * - Admin can view any notification
   */
  canBeViewedBy(ctx: NotificationAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return this.userId === ctx.userId;
  }

  /**
   * Check if user can mark this notification as read.
   * - Only the owner can mark their notifications as read
   * - Admin cannot mark others' notifications as read (that would be weird)
   */
  canBeMarkedReadBy(ctx: NotificationAuthContext): boolean {
    return this.userId === ctx.userId;
  }

  /**
   * Check if user can trigger a resend of failed external delivery.
   * - Only admins can resend notifications
   * - Notification must have a failed or pending external delivery
   */
  canBeResentBy(ctx: NotificationAuthContext): boolean {
    if (!ctx.isAdmin) return false;
    return this.hasFailedDelivery() || this.hasPendingExternalDelivery();
  }

  // ─────────────────────────────────────────────────────────────
  // Helper: Build AuthContext
  // ─────────────────────────────────────────────────────────────

  static buildAuthContext(userId: string, isAdmin: boolean): NotificationAuthContext {
    return { userId, isAdmin };
  }
}
