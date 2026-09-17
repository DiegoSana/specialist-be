import { RequestAttentionReason } from '@prisma/client';
import { DomainEvent } from '../../../shared/domain/events/domain-event';

export type RequestAttentionFlaggedPayload = {
  attentionFlagId: string;
  requestId: string;
  reason: RequestAttentionReason;
  detail: string | null;
};

export class RequestAttentionFlaggedEvent
  implements DomainEvent<RequestAttentionFlaggedPayload>
{
  public static readonly EVENT_NAME = 'requests.request_attention.flagged';

  public readonly name = RequestAttentionFlaggedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestAttentionFlaggedPayload) {}
}
