import { DomainEvent } from '../../../shared/domain/events/domain-event';

export type RequestInterestExpressedPayload = {
  requestId: string;
  clientId: string;
  professionalId: string;
};

export class RequestInterestExpressedEvent
  implements DomainEvent<RequestInterestExpressedPayload>
{
  public static readonly EVENT_NAME = 'requests.request_interest.expressed';

  public readonly name = RequestInterestExpressedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestInterestExpressedPayload) {}
}

