import { SupportMessageEntity } from '../entities/support-message.entity';

/**
 * Association store (append-only), same pattern as `ContactRepository`: no
 * lifecycle, no `save`/`update` - messages are only ever added, never mutated.
 */
export interface SupportMessageRepository {
  add(message: SupportMessageEntity): Promise<SupportMessageEntity>;

  /** Chronological order (oldest -> newest) for the admin chat-style thread view. */
  findByConversationId(conversationId: string): Promise<SupportMessageEntity[]>;

  /** Idempotency: has this inbound Twilio message already been recorded? */
  findByTwilioMessageSid(
    twilioMessageSid: string,
  ): Promise<SupportMessageEntity | null>;
}

// Token for dependency injection
export const SUPPORT_MESSAGE_REPOSITORY = Symbol('SupportMessageRepository');
