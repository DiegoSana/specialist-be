import { InteractionDirection, RequestStatus } from '@prisma/client';
import { RequestEntity } from '../../../domain/entities/request.entity';
import type { FollowUpPayload } from '../../../domain/follow-up';
import { AbstractFollowUpRule } from './abstract-follow-up-rule';

/**
 * Follow-up rule for requests in a given status, updated before X days.
 * Payload is base metadata + title for the template.
 */
export abstract class StatusFollowUpRule extends AbstractFollowUpRule {
  constructor(
    name: string,
    status: RequestStatus,
    days: number,
    direction: InteractionDirection,
    template: string,
  ) {
    super(name, { type: 'BY_STATUS', status, days }, direction, template);
  }

  async buildPayload(request: RequestEntity): Promise<FollowUpPayload> {
    const query = this.getQuery();
    if (query.type !== 'BY_STATUS') {
      throw new Error('StatusFollowUpRule expects BY_STATUS query');
    }
    return {
      metadata: {
        rule: this.name,
        daysSinceUpdate: query.days,
        requestStatus: request.status,
      },
      templateVariables: {
        title: request.title || 'Tu solicitud',
      },
    };
  }
}
