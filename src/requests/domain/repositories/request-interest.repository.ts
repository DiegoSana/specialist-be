import { RequestInterestEntity } from '../entities/request-interest.entity';

/**
 * Association store (append/remove) between Request and ServiceProvider.
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
  remove(requestId: string, serviceProviderId: string): Promise<void>;
  removeAllByRequestId(requestId: string): Promise<void>;
}

export const REQUEST_INTEREST_REPOSITORY = Symbol('RequestInterestRepository');
