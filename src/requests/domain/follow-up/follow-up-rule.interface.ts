import { InteractionDirection } from '@prisma/client';
import { RequestEntity } from '../entities/request.entity';
import { FollowUpQuery } from './follow-up-query';

/** Result of building per-request payload: metadata for the interaction and optional template variables. */
export interface FollowUpPayload {
  metadata: Record<string, unknown>;
  templateVariables?: Record<string, string>;
}

/**
 * Contract for a follow-up rule (DDD: application service / strategy per rule).
 * Each rule knows: how to query candidate requests, who receives the message,
 * which template to use, and how to build metadata/variables for each request.
 */
export interface IFollowUpRule {
  getName(): string;
  getQuery(): FollowUpQuery;
  getDirection(): InteractionDirection;
  getTemplate(): string;

  /**
   * Ladder = one sequence of messages (initial + reminders) sent to one recipient while a
   * request sits in one state. When present, the scheduler sends step N only after exactly N
   * messages of this ladder were already sent for the request's current status (max 3 per
   * ladder), instead of relying on the legacy "< 1 day since last interaction" guard.
   */
  getLadder?(): string;
  /** 0-based position of this rule inside its ladder. */
  getStep?(): number;
  /** Extra per-request eligibility (e.g. auto-closed vs client-confirmed close). */
  appliesTo?(request: RequestEntity): boolean;
  /** True on the last rung of a question ladder: flag AT_RISK if nobody ever replied. */
  escalatesWhenUnanswered?(): boolean;

  /**
   * Build metadata and template variables for a single request.
   * Rule-specific (e.g. load interests and expose interestedProviderIds + count).
   */
  buildPayload(request: RequestEntity): Promise<FollowUpPayload>;
}
