import { RequestStatus } from '@prisma/client';
import { DomainEvent } from '../../../shared/domain/events/domain-event';

export type RequestStatusChangedPayload = {
  requestId: string;
  requestTitle: string;
  clientId: string;
  clientName: string;
  professionalId: string | null;
  professionalName: string | null;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  changedByUserId: string;
};

export class RequestStatusChangedEvent
  implements DomainEvent<RequestStatusChangedPayload>
{
  public static readonly EVENT_NAME = 'requests.request.status_changed';

  public readonly name = RequestStatusChangedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestStatusChangedPayload) {}
}
