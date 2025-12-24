import { DomainEvent } from '../../../shared/domain/events/domain-event';

export type RequestProfessionalAssignedPayload = {
  requestId: string;
  clientId: string;
  professionalId: string;
};

export class RequestProfessionalAssignedEvent
  implements DomainEvent<RequestProfessionalAssignedPayload>
{
  public static readonly EVENT_NAME = 'requests.request.professional_assigned';

  public readonly name = RequestProfessionalAssignedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestProfessionalAssignedPayload) {}
}
