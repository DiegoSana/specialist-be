import { DomainEvent } from '../../../shared/domain/events/domain-event';
import { ProviderType } from '@prisma/client';

export type RequestProfessionalAssignedPayload = {
  requestId: string;
  requestTitle: string;
  clientId: string;
  clientName: string;
  /** @deprecated Use serviceProviderId instead */
  professionalId: string;
  /** The ServiceProvider ID (works for both Professional and Company) */
  serviceProviderId: string;
  /** The userId of the provider (Professional or Company owner) */
  providerUserId: string;
  /** The type of provider */
  providerType: ProviderType;
};

export class RequestProfessionalAssignedEvent
  implements DomainEvent<RequestProfessionalAssignedPayload>
{
  public static readonly EVENT_NAME = 'requests.request.professional_assigned';

  public readonly name = RequestProfessionalAssignedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestProfessionalAssignedPayload) {}
}
