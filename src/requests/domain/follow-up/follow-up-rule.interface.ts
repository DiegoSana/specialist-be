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
   * Build metadata and template variables for a single request.
   * Rule-specific (e.g. load interests and expose interestedProviderIds + count).
   */
  buildPayload(request: RequestEntity): Promise<FollowUpPayload>;
}
