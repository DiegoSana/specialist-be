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
   * Find the most recent (any status) automated FOLLOW_UP interaction sent to this
   * phone number, created no earlier than `notOlderThan` - the *only* candidate ever
   * considered, regardless of which request it belongs to.
   *
   * Deliberate invariant, not just an implementation detail: this only matches an
   * automated FOLLOW_UP interaction (`interactionType: InteractionType.FOLLOW_UP`) -
   * never `RESPONSE`/`STATUS_UPDATE` or any other type, even though today those are
   * never actually created. An inbound WhatsApp reply may only be treated as a reply
   * to something we automatically sent; a human-authored message (e.g. from the
   * support context) must never be matched here and fed to the intent classifier.
   *
   * Matching rule ("last message wins, no reach-back" - replaces an earlier version
   * of this method that walked back through older, still-open candidates on other
   * requests): an inbound reply always matches the single most recent FOLLOW_UP
   * interaction sent to this phone, no matter which request created it - this is
   * also how a human reading WhatsApp would interpret their own reply, since there
   * is no threading. If that interaction is still open
   * (PENDING/SENT/DELIVERED), it's the match. If it's already RESPONDED/FAILED, or
   * none exists within the window, this returns `null` - the caller then falls
   * through to `forkUnmatchedInboundMessage`/support instead of guessing which of
   * several requests open on the same phone the message was actually about (an
   * older, still-unanswered request on the same phone is never reachable this way;
   * `FollowUpSchedulerJob`'s per-phone stagger guard, see
   * `findMostRecentFollowUpTimestampByPhone`, is what keeps that scenario rare by
   * spacing out when two different requests on the same phone can each have an open
   * follow-up in the first place). Used when matching inbound messages where we
   * don't know the requestId.
   */
  findMostRecentByPhone(
    phoneNumber: string,
    notOlderThan: Date,
  ): Promise<RequestInteractionEntity | null>;

  /**
   * Timestamp of the most recent automated FOLLOW_UP interaction (any status) sent
   * to this phone number, across every request - or `null` if none exists.
   *
   * Used by `FollowUpSchedulerJob` to space out follow-ups per phone number rather
   * than per request: without this, two different requests belonging to the same
   * phone could each run their own escalation ladder independently, and once both
   * had an open follow-up at the same time, `findMostRecentByPhone`'s "last message
   * wins" rule would permanently route inbound replies to whichever request sent
   * the newer message, leaving the other stalled with no way to ever receive a
   * matched reply until its interaction ages out of the match window.
   */
  findMostRecentFollowUpTimestampByPhone(
    phoneNumber: string,
  ): Promise<Date | null>;

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
