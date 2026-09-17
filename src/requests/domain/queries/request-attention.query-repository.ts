/**
 * RequestAttentionFlag Query Repository
 *
 * Handles read-only queries for the admin "needs attention" panel.
 * Returns plain read-model types, not domain entities.
 *
 * See: docs/architecture/QUERY_REPOSITORIES.md
 */

export interface AttentionFlagSummary {
  id: string;
  requestId: string;
  requestTitle: string;
  requestStatus: string;
  reason: string;
  detail: string | null;
  createdAt: Date;
}

export interface RequestAttentionQueryRepository {
  /**
   * List all unresolved attention flags, newest first, with request context.
   */
  findAllOpen(params: {
    skip: number;
    take: number;
  }): Promise<{ items: AttentionFlagSummary[]; total: number }>;
}

// Token for dependency injection
export const REQUEST_ATTENTION_QUERY_REPOSITORY = Symbol(
  'RequestAttentionQueryRepository',
);
