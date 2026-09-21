import { Inject, Injectable } from '@nestjs/common';
import { REQUEST_REPOSITORY } from '../../domain/repositories/request.repository';
import type { RequestRepository } from '../../domain/repositories/request.repository';
import type { FollowUpQuery } from '../../domain/follow-up';
import { RequestEntity } from '../../domain/entities/request.entity';

/**
 * Resolves a follow-up query to the list of candidate requests.
 * Maps query type + params to the appropriate repository method.
 */
@Injectable()
export class FollowUpQueryExecutor {
  constructor(
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
  ) {}

  async getRequests(query: FollowUpQuery, now: Date): Promise<RequestEntity[]> {
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - query.days);

    if (query.type === 'BY_STATUS') {
      // No provider filter: ladders also cover states without an assigned provider
      // (PUBLISHED, EXPIRED, ...); TO_PROVIDER rules skip requests with no provider when
      // resolving the recipient phone.
      return this.requestRepository.findStaleByStatus(query.status, cutoffDate);
    }
    return this.requestRepository.findPendingWithInterestsUpdatedBefore(
      cutoffDate,
    );
  }
}
