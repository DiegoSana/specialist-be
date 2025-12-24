import { DomainEvent } from '../../../shared/domain/events/domain-event';

export type RequestCreatedPayload = {
  requestId: string;
  clientId: string;
  isPublic: boolean;
  professionalId: string | null;
  tradeId: string | null;
};

export class RequestCreatedEvent implements DomainEvent<RequestCreatedPayload> {
  public static readonly EVENT_NAME = 'requests.request.created';

  public readonly name = RequestCreatedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestCreatedPayload) {}
}
