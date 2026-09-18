import { DomainEvent } from '../../../shared/domain/events/domain-event';

export type SupportConversationAttentionFlaggedPayload = {
  conversationId: string;
  phoneNumber: string;
  userId: string | null;
};

/**
 * Published only when a SupportConversation is created or transitions
 * RESOLVED -> OPEN (see SupportConversationEntity.recordInboundMessage /
 * SupportConversationService.receiveInboundMessage). Never on a 2nd..Nth inbound
 * message on an already-OPEN conversation - idempotency lives in the entity's
 * state, not in a query, mirroring RequestAttentionService.flag's dedup.
 */
export class SupportConversationAttentionFlaggedEvent
  implements DomainEvent<SupportConversationAttentionFlaggedPayload>
{
  public static readonly EVENT_NAME = 'support.conversation.attention_flagged';

  public readonly name = SupportConversationAttentionFlaggedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(
    public readonly payload: SupportConversationAttentionFlaggedPayload,
  ) {}
}
