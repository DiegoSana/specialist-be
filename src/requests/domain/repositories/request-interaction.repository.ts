import { RequestInteractionEntity } from '../entities/request-interaction.entity';

export interface RequestInteractionRepository {
  findById(id: string): Promise<RequestInteractionEntity | null>;

  findByRequestId(requestId: string): Promise<RequestInteractionEntity[]>;

  findPendingFollowUps(now: Date): Promise<RequestInteractionEntity[]>;

  findByTwilioMessageSid(
    messageSid: string,
  ): Promise<RequestInteractionEntity | null>;

  /**
   * Find the most recent interaction for a request and phone number.
   * Useful for matching inbound messages to the correct interaction.
   * Searches by recipientPhone stored in metadata.
   */
  findMostRecentByRequestAndPhone(
    requestId: string,
    phoneNumber: string,
  ): Promise<RequestInteractionEntity | null>;

  /**
   * Find the most recent pending or delivered interaction for a phone number,
   * created no earlier than `notOlderThan`.
   *
   * Deliberate invariant, not just an implementation detail: this only matches an
   * automated FOLLOW_UP interaction (`interactionType: InteractionType.FOLLOW_UP`) -
   * never `RESPONSE`/`STATUS_UPDATE` or any other type, even though today those are
   * never actually created. An inbound WhatsApp reply may only be treated as a reply
   * to something we automatically sent; a human-authored message (e.g. from the
   * support context) must never be matched here and fed to the intent classifier.
   * Used when matching inbound messages where we don't know the requestId.
   */
  findMostRecentByPhone(
    phoneNumber: string,
    notOlderThan: Date,
  ): Promise<RequestInteractionEntity | null>;

  /**
   * Request id of the most recent interaction of any type/status/age sent to this
   * phone number. Gives an unmatched inbound message (support fork) request context.
   */
  findMostRecentRequestIdByPhone(phoneNumber: string): Promise<string | null>;

  /**
   * Check if there's a pending follow-up interaction for a request.
   * Used to avoid scheduling duplicate follow-ups.
   */
  hasPendingFollowUp(requestId: string): Promise<boolean>;

  /**
   * Check if this request has ever had a RESPONDED interaction. Used to detect
   * "the follow-up ladder is exhausted and nobody ever replied" (possible abandonment).
   */
  hasRespondedInteraction(requestId: string): Promise<boolean>;

  /**
   * Find the most recent interaction (of any type) for a request.
   * Used to calculate time since last activity.
   */
  findMostRecentByRequestId(
    requestId: string,
  ): Promise<RequestInteractionEntity | null>;

  /**
   * Find failed interactions that are scheduled for retry.
   * Used by the dispatch job to retry failed messages.
   */
  findFailedRetryable(now: Date): Promise<RequestInteractionEntity[]>;

  /**
   * Find sent interactions that haven't been delivered yet.
   * Used by status checker job to verify message delivery.
   */
  findSentButNotDelivered(sentAfter: Date): Promise<RequestInteractionEntity[]>;

  /**
   * Persist the aggregate.
   * Implementation decides create vs update based on existence.
   */
  save(
    interaction: RequestInteractionEntity,
  ): Promise<RequestInteractionEntity>;
}

// Token for dependency injection
export const REQUEST_INTERACTION_REPOSITORY = Symbol(
  'RequestInteractionRepository',
);
