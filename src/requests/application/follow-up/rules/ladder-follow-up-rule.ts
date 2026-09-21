import { InteractionDirection } from '@prisma/client';
import { RequestEntity } from '../../../domain/entities/request.entity';
import { REQUEST_STATUS_LABELS_ES } from '../../../domain/entities/request-status.metadata';
import type { FollowUpPayload, FollowUpQuery } from '../../../domain/follow-up';
import type { RequestInterestRepository } from '../../../domain/repositories/request-interest.repository';
import { buildFollowUpVariables } from '../follow-up-variables';
import { AbstractFollowUpRule } from './abstract-follow-up-rule';

export interface LadderRuleConfig {
  name: string;
  /** Unique per (state, recipient, purpose); see IFollowUpRule.getLadder. */
  ladder: string;
  query: FollowUpQuery;
  direction: InteractionDirection;
  template: string;
  step: number;
  escalatesWhenUnanswered?: boolean;
  appliesTo?: (request: RequestEntity) => boolean;
  /** Needed only by the PENDING_WITH_INTERESTS query (lists interested providers). */
  interestRepository?: RequestInterestRepository;
}

/**
 * One rung (initial message or reminder) of a follow-up ladder. Data-driven so the whole
 * "Follow-up por WhatsApp: reglas por estado" table lives in follow-up-ladders.ts.
 * Reminders (step > 0) reuse the same template with the "Te escribimos de nuevo por ..." prefix.
 */
export class LadderFollowUpRule extends AbstractFollowUpRule {
  constructor(private readonly config: LadderRuleConfig) {
    super(config.name, config.query, config.direction, config.template);
  }

  getLadder(): string {
    return this.config.ladder;
  }

  getStep(): number {
    return this.config.step;
  }

  appliesTo(request: RequestEntity): boolean {
    return this.config.appliesTo ? this.config.appliesTo(request) : true;
  }

  escalatesWhenUnanswered(): boolean {
    return !!this.config.escalatesWhenUnanswered;
  }

  async buildPayload(request: RequestEntity): Promise<FollowUpPayload> {
    const variables = buildFollowUpVariables(
      request,
      this.direction,
      this.config.step > 0,
    );
    const metadata: Record<string, unknown> = {
      rule: this.name,
      ladder: this.config.ladder,
      step: this.config.step,
      requestStatus: request.status,
      daysSinceUpdate: this.query.days,
    };

    variables.estado =
      REQUEST_STATUS_LABELS_ES[request.status] ?? request.status;

    if (this.query.type === 'PENDING_WITH_INTERESTS') {
      if (!this.config.interestRepository) {
        throw new Error(`${this.name}: interestRepository is required`);
      }
      const interests = await this.config.interestRepository.findByRequestId(
        request.id,
      );
      if (interests.length === 0) {
        throw new Error(`${this.name}: request ${request.id} has no interests`);
      }
      const ordered = [...interests].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      variables.cantidad = String(ordered.length);
      metadata.interestedProviderIds = ordered.map((i) => i.serviceProviderId);
    }

    return { metadata, templateVariables: variables };
  }
}
