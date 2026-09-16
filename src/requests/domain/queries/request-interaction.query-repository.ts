/**
 * RequestInteraction Query Repository
 *
 * Handles read-only queries for the admin WhatsApp conversations viewer.
 * Returns plain read-model types, not domain entities.
 *
 * See: docs/architecture/QUERY_REPOSITORIES.md
 */

export interface ConversationSummary {
  requestId: string;
  requestTitle: string;
  requestStatus: string;
  clientName: string;
  providerName: string | null;
  lastMessagePreview: string;
  lastMessageAt: Date;
  lastMessageDirection: string;
  lastMessageStatus: string;
}

export interface RequestInteractionQueryRepository {
  /**
   * List one row per request that has at least one RequestInteraction,
   * ordered by most recent interaction activity descending.
   */
  findConversations(params: {
    skip: number;
    take: number;
    search?: string;
  }): Promise<{ items: ConversationSummary[]; total: number }>;
}

// Token for dependency injection
export const REQUEST_INTERACTION_QUERY_REPOSITORY = Symbol(
  'RequestInteractionQueryRepository',
);
