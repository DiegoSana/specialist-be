import { InteractionDirection, RequestStatus } from '@prisma/client';
import { AUTO_CLOSED_STATUS_REASON } from '../../domain/entities/request-status.metadata';
import type { RequestEntity } from '../../domain/entities/request.entity';
import type { IFollowUpRule } from '../../domain/follow-up';
import type { RequestInterestRepository } from '../../domain/repositories/request-interest.repository';
import { LadderFollowUpRule } from './rules/ladder-follow-up-rule';

interface LadderDef {
  /** Ladder id; the recipient side is appended for both-parties ladders. */
  id: string;
  status: RequestStatus;
  /** Use the PENDING_WITH_INTERESTS query (PUBLISHED requests with at least one interested provider). */
  withInterests?: boolean;
  directions: InteractionDirection[];
  template: string;
  /** Days since entering the state (proxied by Request.updatedAt) for each message; max 3. */
  days: number[];
  escalatesWhenUnanswered?: boolean;
  appliesTo?: (request: RequestEntity) => boolean;
}

const TO_CLIENT = InteractionDirection.TO_CLIENT;
const TO_PROVIDER = InteractionDirection.TO_PROVIDER;
const isAutoClosed = (r: RequestEntity) =>
  r.statusReason === AUTO_CLOSED_STATUS_REASON;

/**
 * "Follow-up por WhatsApp: reglas por estado" from docs/EspecialistBRC — Estados del pedido.md.
 * Only the three question ladders (P1-P3) can move a request's state via the reply; the rest are
 * notices (A1-A7) whose action happens in the app. Day counts are proposals to tune.
 */
export const FOLLOW_UP_LADDERS: LadderDef[] = [
  {
    id: 'SENT_NOTICE',
    status: RequestStatus.SENT,
    directions: [TO_PROVIDER],
    template: 'notice_request_sent',
    days: [0, 2, 4],
  },
  {
    id: 'PUBLISHED_INTERESTS_NOTICE',
    status: RequestStatus.PUBLISHED,
    withInterests: true,
    directions: [TO_CLIENT],
    template: 'notice_interests_published',
    days: [0, 2, 4],
  },
  {
    id: 'CONTACT_RELEASED_NOTICE',
    status: RequestStatus.CONTACT_RELEASED,
    directions: [TO_CLIENT, TO_PROVIDER],
    template: 'notice_contact_released',
    days: [0],
  },
  {
    id: 'CONTACT_RELEASED_QUESTION',
    status: RequestStatus.CONTACT_RELEASED,
    directions: [TO_CLIENT, TO_PROVIDER],
    template: 'question_agreement',
    days: [2, 4, 6],
    escalatesWhenUnanswered: true,
  },
  {
    id: 'IN_PROGRESS_QUESTION',
    status: RequestStatus.IN_PROGRESS,
    directions: [TO_PROVIDER],
    template: 'question_progress',
    days: [7, 14, 21],
    escalatesWhenUnanswered: true,
  },
  {
    id: 'FINISHED_QUESTION',
    status: RequestStatus.FINISHED,
    directions: [TO_CLIENT],
    template: 'question_satisfaction',
    days: [0, 2, 4],
    escalatesWhenUnanswered: true,
  },
  {
    id: 'CLOSED_NOTICE_PROVIDER',
    status: RequestStatus.CLOSED,
    directions: [TO_PROVIDER],
    template: 'notice_request_closed',
    days: [0, 3],
  },
  {
    id: 'CLOSED_NOTICE_CLIENT',
    status: RequestStatus.CLOSED,
    directions: [TO_CLIENT],
    template: 'notice_request_closed',
    days: [0, 3],
    appliesTo: (r) => !isAutoClosed(r),
  },
  {
    id: 'AUTO_CLOSED_NOTICE',
    status: RequestStatus.CLOSED,
    directions: [TO_CLIENT],
    template: 'notice_auto_closed',
    days: [0],
    appliesTo: isAutoClosed,
  },
  {
    id: 'REJECTED_NOTICE',
    status: RequestStatus.REJECTED,
    directions: [TO_CLIENT],
    template: 'notice_request_rejected',
    days: [0],
  },
  {
    id: 'EXPIRED_NOTICE',
    status: RequestStatus.EXPIRED,
    directions: [TO_CLIENT],
    template: 'notice_no_agreement',
    days: [0],
  },
  {
    id: 'NO_RESPONSE_NOTICE',
    status: RequestStatus.NO_RESPONSE,
    directions: [TO_CLIENT],
    template: 'notice_no_agreement',
    days: [0],
  },
  {
    id: 'NOT_COMPLETED_NOTICE',
    status: RequestStatus.NOT_COMPLETED,
    directions: [TO_CLIENT],
    template: 'notice_no_agreement',
    days: [0],
  },
  {
    id: 'ABANDONED_NOTICE',
    status: RequestStatus.ABANDONED,
    directions: [TO_CLIENT],
    template: 'notice_no_agreement',
    days: [0],
  },
];

/** Expands FOLLOW_UP_LADDERS into one rule per (ladder, recipient, step). */
export function buildFollowUpRules(
  interestRepository: RequestInterestRepository,
): IFollowUpRule[] {
  const rules: IFollowUpRule[] = [];
  for (const def of FOLLOW_UP_LADDERS) {
    if (def.days.length > 3) {
      throw new Error(`Ladder ${def.id} exceeds 3 messages per state`);
    }
    for (const direction of def.directions) {
      const side = direction === TO_CLIENT ? 'CLIENT' : 'PROVIDER';
      const ladder = def.directions.length > 1 ? `${def.id}_${side}` : def.id;
      def.days.forEach((days, step) => {
        rules.push(
          new LadderFollowUpRule({
            name: `${ladder}_${days}D`,
            ladder,
            query: def.withInterests
              ? { type: 'PENDING_WITH_INTERESTS', days }
              : { type: 'BY_STATUS', status: def.status, days },
            direction,
            template: def.template,
            step,
            escalatesWhenUnanswered:
              def.escalatesWhenUnanswered && step === def.days.length - 1,
            appliesTo: def.appliesTo,
            interestRepository: def.withInterests
              ? interestRepository
              : undefined,
          }),
        );
      });
    }
  }
  return rules;
}
