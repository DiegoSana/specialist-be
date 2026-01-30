import { RequestInteractionEntity } from '../entities/request-interaction.entity';
import {
  InteractionStatus,
  InteractionType,
} from '@prisma/client';

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
   * Find the most recent pending or delivered interaction for a phone number.
   * Used when matching inbound messages where we don't know the requestId.
   */
  findMostRecentByPhone(
    phoneNumber: string,
  ): Promise<RequestInteractionEntity | null>;

  /**
   * Check if there's a pending follow-up interaction for a request.
   * Used to avoid scheduling duplicate follow-ups.
   */
  hasPendingFollowUp(requestId: string): Promise<boolean>;

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
  findSentButNotDelivered(
    sentAfter: Date,
  ): Promise<RequestInteractionEntity[]>;

  /**
   * Persist the aggregate.
   * Implementation decides create vs update based on existence.
   */
  save(interaction: RequestInteractionEntity): Promise<RequestInteractionEntity>;
}

// Token for dependency injection
export const REQUEST_INTERACTION_REPOSITORY = Symbol(
  'RequestInteractionRepository',
);

