import { DomainEvent } from '../../../shared/domain/events/domain-event';
import { ProviderType } from '@prisma/client';

export type RequestInterestExpressedPayload = {
  requestId: string;
  requestTitle: string;
  clientId: string;
  /** @deprecated Use serviceProviderId instead */
  professionalId: string;
  /** The ServiceProvider ID (works for both Professional and Company) */
  serviceProviderId: string;
  /** The userId of the provider (Professional or Company owner) */
  providerUserId: string;
  /** The type of provider */
  providerType: ProviderType;
  /** Display name of the provider */
  providerName: string;
  /** @deprecated Use providerName instead */
  professionalName: string;
};

export class RequestInterestExpressedEvent
  implements DomainEvent<RequestInterestExpressedPayload>
{
  public static readonly EVENT_NAME = 'requests.request_interest.expressed';

  public readonly name = RequestInterestExpressedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestInterestExpressedPayload) {}
}
