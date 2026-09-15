import { Inject, Injectable } from '@nestjs/common';
import { InteractionDirection } from '@prisma/client';
import { RequestEntity } from '../../../domain/entities/request.entity';
import type { FollowUpPayload } from '../../../domain/follow-up';
import { REQUEST_INTEREST_REPOSITORY } from '../../../domain/repositories/request-interest.repository';
import type { RequestInterestRepository } from '../../../domain/repositories/request-interest.repository';
import { AbstractFollowUpRule } from './abstract-follow-up-rule';

/**
 * Follow-up: PENDING request with at least one interest but no provider assigned
 * after 3 days. Asks client to assign a specialist; payload includes ordered
 * interestedProviderIds and count for template.
 */
@Injectable()
export class Pending3DaysWithInterestsFollowUpRule extends AbstractFollowUpRule {
  constructor(
    @Inject(REQUEST_INTEREST_REPOSITORY)
    private readonly interestRepository: RequestInterestRepository,
  ) {
    super(
      'PENDING_3_DAYS_WITH_INTERESTS',
      { type: 'PENDING_WITH_INTERESTS', days: 3 },
      InteractionDirection.TO_CLIENT,
      'follow_up_pending_3_days_with_interests',
    );
  }

  async buildPayload(request: RequestEntity): Promise<FollowUpPayload> {
    const interests = await this.interestRepository.findByRequestId(request.id);
    if (interests.length === 0) {
      throw new Error(
        `Pending3DaysWithInterestsFollowUpRule: request ${request.id} has no interests`,
      );
    }
    const ordered = [...interests].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const interestedProviderIds = ordered.map((i) => i.serviceProviderId);
    const query = this.getQuery();
    const days = query.type === 'PENDING_WITH_INTERESTS' ? query.days : 0;
    return {
      metadata: {
        rule: this.name,
        daysSinceUpdate: days,
        requestStatus: request.status,
        interestedProviderIds,
      },
      templateVariables: {
        title: request.title || 'Tu solicitud',
        count: String(interestedProviderIds.length),
      },
    };
  }
}
