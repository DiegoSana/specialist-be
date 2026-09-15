import { InteractionDirection } from '@prisma/client';
import { RequestEntity } from '../../../domain/entities/request.entity';
import type {
  FollowUpPayload,
  FollowUpQuery,
  IFollowUpRule,
} from '../../../domain/follow-up';

/**
 * Base class for follow-up rules. Subclasses define query, direction, template,
 * and how to build metadata + template variables per request.
 */
export abstract class AbstractFollowUpRule implements IFollowUpRule {
  constructor(
    protected readonly name: string,
    protected readonly query: FollowUpQuery,
    protected readonly direction: InteractionDirection,
    protected readonly template: string,
  ) {}

  getName(): string {
    return this.name;
  }

  getQuery(): FollowUpQuery {
    return this.query;
  }

  getDirection(): InteractionDirection {
    return this.direction;
  }

  getTemplate(): string {
    return this.template;
  }

  abstract buildPayload(request: RequestEntity): Promise<FollowUpPayload>;
}
