import { SupportConversationStatus } from '@prisma/client';

/** WhatsApp Business API's real reply window: outside 24h since the last inbound
 * message, only an approved template can be sent - a free-text admin reply would
 * be rejected by Twilio/Meta. This is a platform limit, not a product choice. */
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * One row per phone number. Tracks a general WhatsApp support conversation,
 * independent of any `Request` - unlike `RequestInteraction`, this aggregate never
 * feeds the intent classifier and never changes `Request.status`.
 *
 * `userId`/`relatedRequestId` are soft references (no Prisma FK, see the migration):
 * `support` never depends structurally on `identity`/`requests` at the schema level,
 * mirroring how domain event payloads carry ids without a DB relation.
 */
export class SupportConversationEntity {
  constructor(
    public readonly id: string,
    public readonly phoneNumber: string,
    public readonly userId: string | null,
    public readonly relatedRequestId: string | null,
    public readonly status: SupportConversationStatus,
    public readonly lastInboundAt: Date | null,
    public readonly lastOutboundAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly resolvedAt: Date | null,
    public readonly resolvedByUserId: string | null,
  ) {}

  static createFromInboundMessage(params: {
    id: string;
    phoneNumber: string;
    userId: string | null;
    relatedRequestId: string | null;
    now?: Date;
  }): SupportConversationEntity {
    const now = params.now ?? new Date();
    return new SupportConversationEntity(
      params.id,
      params.phoneNumber,
      params.userId,
      params.relatedRequestId,
      SupportConversationStatus.OPEN,
      now, // lastInboundAt
      null, // lastOutboundAt
      now,
      now,
      null, // resolvedAt
      null, // resolvedByUserId
    );
  }

  isOpen(): boolean {
    return this.status === SupportConversationStatus.OPEN;
  }

  isResolved(): boolean {
    return this.status === SupportConversationStatus.RESOLVED;
  }

  /**
   * WhatsApp Business API only allows a free-text (non-template) reply within 24h
   * of the customer's last inbound message. `canReplyNow` in the admin API is this,
   * computed server-side so the frontend never has to reimplement it.
   */
  isWithinReplyWindow(now: Date = new Date()): boolean {
    if (!this.lastInboundAt) {
      return false;
    }
    return now.getTime() - this.lastInboundAt.getTime() < REPLY_WINDOW_MS;
  }

  /**
   * Record a new inbound message on an already-persisted conversation.
   * Reopens a RESOLVED conversation (idempotency lives in the entity's state, not in
   * a query: the caller uses `reopened` to decide whether to publish the
   * attention-needed event, so message 2..N on an already-OPEN conversation never
   * re-notifies).
   */
  recordInboundMessage(now: Date = new Date()): {
    conversation: SupportConversationEntity;
    reopened: boolean;
  } {
    const wasResolved = this.isResolved();
    const conversation = new SupportConversationEntity(
      this.id,
      this.phoneNumber,
      this.userId,
      this.relatedRequestId,
      SupportConversationStatus.OPEN,
      now,
      this.lastOutboundAt,
      this.createdAt,
      now,
      wasResolved ? null : this.resolvedAt,
      wasResolved ? null : this.resolvedByUserId,
    );
    return { conversation, reopened: wasResolved };
  }

  /** Latest known request context wins; no-op when unchanged or unknown. */
  withRelatedRequestId(requestId: string | null): SupportConversationEntity {
    if (!requestId || requestId === this.relatedRequestId) {
      return this;
    }
    return new SupportConversationEntity(
      this.id,
      this.phoneNumber,
      this.userId,
      requestId,
      this.status,
      this.lastInboundAt,
      this.lastOutboundAt,
      this.createdAt,
      this.updatedAt,
      this.resolvedAt,
      this.resolvedByUserId,
    );
  }

  /** Record a successful admin reply having been sent. */
  recordOutboundMessage(now: Date = new Date()): SupportConversationEntity {
    return new SupportConversationEntity(
      this.id,
      this.phoneNumber,
      this.userId,
      this.relatedRequestId,
      this.status,
      this.lastInboundAt,
      now,
      this.createdAt,
      now,
      this.resolvedAt,
      this.resolvedByUserId,
    );
  }

  /** Idempotent: resolving an already-resolved conversation is a no-op state-wise. */
  resolve(
    adminUserId: string,
    now: Date = new Date(),
  ): SupportConversationEntity {
    if (this.isResolved()) {
      return this;
    }
    return new SupportConversationEntity(
      this.id,
      this.phoneNumber,
      this.userId,
      this.relatedRequestId,
      SupportConversationStatus.RESOLVED,
      this.lastInboundAt,
      this.lastOutboundAt,
      this.createdAt,
      now,
      now,
      adminUserId,
    );
  }

  /** Idempotent: reopening an already-open conversation is a no-op state-wise. */
  reopen(now: Date = new Date()): SupportConversationEntity {
    if (this.isOpen()) {
      return this;
    }
    return new SupportConversationEntity(
      this.id,
      this.phoneNumber,
      this.userId,
      this.relatedRequestId,
      SupportConversationStatus.OPEN,
      this.lastInboundAt,
      this.lastOutboundAt,
      this.createdAt,
      now,
      null,
      null,
    );
  }
}
