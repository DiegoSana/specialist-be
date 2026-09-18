import { SupportMessageDirection } from '@prisma/client';

/**
 * A single WhatsApp message within a `SupportConversation`. Append-only association
 * store (same pattern as `ContactRepository`) - no PENDING/SENT/FAILED lifecycle like
 * `RequestInteraction`: an admin's outbound send is synchronous through the messaging
 * port, and if it fails nothing is persisted (accepted simplification for v1, see
 * src/support/CLAUDE.md).
 */
export class SupportMessageEntity {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly direction: SupportMessageDirection,
    public readonly body: string,
    public readonly twilioMessageSid: string | null,
    public readonly sentByUserId: string | null,
    public readonly createdAt: Date,
  ) {}

  static createInbound(params: {
    id: string;
    conversationId: string;
    body: string;
    twilioMessageSid: string | null;
    now?: Date;
  }): SupportMessageEntity {
    return new SupportMessageEntity(
      params.id,
      params.conversationId,
      SupportMessageDirection.INBOUND,
      params.body,
      params.twilioMessageSid,
      null,
      params.now ?? new Date(),
    );
  }

  static createOutbound(params: {
    id: string;
    conversationId: string;
    body: string;
    sentByUserId: string;
    twilioMessageSid?: string | null;
    now?: Date;
  }): SupportMessageEntity {
    return new SupportMessageEntity(
      params.id,
      params.conversationId,
      SupportMessageDirection.OUTBOUND,
      params.body,
      params.twilioMessageSid ?? null,
      params.sentByUserId,
      params.now ?? new Date(),
    );
  }

  isInbound(): boolean {
    return this.direction === SupportMessageDirection.INBOUND;
  }
}
