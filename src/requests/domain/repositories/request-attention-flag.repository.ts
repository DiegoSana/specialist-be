import { RequestAttentionReason } from '@prisma/client';
import { RequestAttentionFlagEntity } from '../entities/request-attention-flag.entity';

/**
 * Association store (append/resolve) for RequestAttentionFlag — mirrors
 * RequestInterestRepository's style, not an aggregate with save().
 */
export interface RequestAttentionFlagRepository {
  /**
   * True if there's an unresolved flag for this request with this exact reason.
   * Used to avoid duplicate flags/notifications while a request stays in the same
   * problematic state (e.g. the follow-up ladder keeps re-triggering every ~1 day).
   */
  hasOpenByRequestAndReason(
    requestId: string,
    reason: RequestAttentionReason,
  ): Promise<boolean>;

  add(data: {
    requestId: string;
    reason: RequestAttentionReason;
    detail: string | null;
  }): Promise<RequestAttentionFlagEntity>;

  findById(id: string): Promise<RequestAttentionFlagEntity | null>;

  resolve(
    id: string,
    resolvedByUserId: string,
    now?: Date,
  ): Promise<RequestAttentionFlagEntity>;
}

export const REQUEST_ATTENTION_FLAG_REPOSITORY = Symbol(
  'RequestAttentionFlagRepository',
);
