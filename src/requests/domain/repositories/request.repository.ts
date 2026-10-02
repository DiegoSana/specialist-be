import { RequestEntity } from '../entities/request.entity';
import { RequestStatus } from '@prisma/client';

export interface RequestRepository {
  findById(id: string): Promise<RequestEntity | null>;
  findByClientId(clientId: string): Promise<RequestEntity[]>;
  findByProviderId(providerId: string): Promise<RequestEntity[]>;
  findPublicRequests(tradeIds?: string[]): Promise<RequestEntity[]>;
  findAvailableForProfessional(
    tradeIds: string[],
    city?: string,
    zone?: string,
  ): Promise<RequestEntity[]>;

  /**
   * Find requests by status that were updated before a certain date.
   * Useful for finding requests that need follow-ups.
   */
  findByStatusAndUpdatedBefore(
    status: RequestStatus,
    updatedBefore: Date,
  ): Promise<RequestEntity[]>;

  /**
   * Find requests in `status` last updated before `updatedBefore`, regardless of whether a
   * provider is assigned (unlike findByStatusAndUpdatedBefore, which only returns assigned
   * ones). Used by the expiration job for PUBLISHED requests, which never have a provider.
   */
  findStaleByStatus(
    status: RequestStatus,
    updatedBefore: Date,
  ): Promise<RequestEntity[]>;

  /**
   * Find PENDING public requests that have at least one interest but no provider
   * assigned, and were updated before the given date.
   * Used for follow-up "assign a specialist" (e.g. 3 days with interests, no assignment).
   */
  findPendingWithInterestsUpdatedBefore(
    updatedBefore: Date,
  ): Promise<RequestEntity[]>;

  /**
   * Opción A (colección de agregados): persiste el aggregate completo.
   * La implementación decide create vs update.
   */
  save(request: RequestEntity): Promise<RequestEntity>;

  /**
   * Bulk-delete every Request whose title starts with `titlePrefix` (case-sensitive),
   * cascading to RequestInterest/Review/RequestAttentionFlag/RequestInteraction at the DB
   * level (all declare `onDelete: Cascade` on their `request` relation). Test-data cleanup
   * only (specialist-e2e's global teardown) - not a single-aggregate mutation, so it's a
   * deliberate exception to the `findBy*`/`save` shape. Returns the number of rows deleted.
   */
  deleteByTitlePrefix(titlePrefix: string): Promise<number>;
}

// Token for dependency injection
export const REQUEST_REPOSITORY = Symbol('RequestRepository');
