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
}

// Token for dependency injection
export const REQUEST_REPOSITORY = Symbol('RequestRepository');
