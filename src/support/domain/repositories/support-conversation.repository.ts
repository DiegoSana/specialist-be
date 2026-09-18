import { SupportConversationStatus } from '@prisma/client';
import { SupportConversationEntity } from '../entities/support-conversation.entity';

export interface SupportConversationListFilter {
  status?: SupportConversationStatus;
  page: number;
  limit: number;
}

export interface SupportConversationRepository {
  findById(id: string): Promise<SupportConversationEntity | null>;

  /** `phoneNumber` is unique - one conversation per phone number. */
  findByPhoneNumber(
    phoneNumber: string,
  ): Promise<SupportConversationEntity | null>;

  /**
   * Admin listing, most recently updated first. `status` omitted means all
   * statuses (the admin "ALL" tab).
   */
  findManyForAdmin(
    filter: SupportConversationListFilter,
  ): Promise<{ items: SupportConversationEntity[]; total: number }>;

  /**
   * Persist the aggregate. Implementation decides create vs update based on
   * existence.
   */
  save(
    conversation: SupportConversationEntity,
  ): Promise<SupportConversationEntity>;
}

// Token for dependency injection
export const SUPPORT_CONVERSATION_REPOSITORY = Symbol(
  'SupportConversationRepository',
);
