import { RequestInterestEntity } from '../entities/request-interest.entity';

/**
 * Association store (add + status transitions via save) between Request and ServiceProvider.
 * Not an aggregate with "save", but explicit interest operations.
 */
export interface RequestInterestRepository {
  findByRequestId(requestId: string): Promise<RequestInterestEntity[]>;
  findByServiceProviderId(
    serviceProviderId: string,
  ): Promise<RequestInterestEntity[]>;
  findByRequestAndProvider(
    requestId: string,
    serviceProviderId: string,
  ): Promise<RequestInterestEntity | null>;
  add(data: {
    requestId: string;
    serviceProviderId: string;
    message: string | null;
  }): Promise<RequestInterestEntity>;
  /** Persists a status/message change on an existing interest row. */
  save(interest: RequestInterestEntity): Promise<RequestInterestEntity>;
  /** Marks every other still-INTERESTED interest of the request as NOT_CHOSEN. */
  markOthersNotChosen(
    requestId: string,
    chosenServiceProviderId: string,
  ): Promise<void>;
  /** Resets CHOSEN/NOT_CHOSEN interests of the request back to INTERESTED. */
  resetDecided(requestId: string): Promise<void>;
  remove(requestId: string, serviceProviderId: string): Promise<void>;
  removeAllByRequestId(requestId: string): Promise<void>;
}

export const REQUEST_INTEREST_REPOSITORY = Symbol('RequestInterestRepository');
