import { DomainEvent } from '../../../shared/domain/events/domain-event';
import { ProviderType, RequestInterestStatus } from '@prisma/client';

export type RequestInterestStatusChangedPayload = {
  requestId: string;
  requestTitle: string;
  clientId: string;
  serviceProviderId: string;
  /** The userId of the provider (Professional or Company owner); null if it could not be resolved */
  providerUserId: string | null;
  providerType: ProviderType | null;
  providerName: string | null;
  fromStatus: RequestInterestStatus;
  toStatus: RequestInterestStatus;
  /** The user who caused the change (client choosing, provider withdrawing, ...) */
  changedByUserId: string;
};

export class RequestInterestStatusChangedEvent
  implements DomainEvent<RequestInterestStatusChangedPayload>
{
  public static readonly EVENT_NAME =
    'requests.request_interest.status_changed';

  public readonly name = RequestInterestStatusChangedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestInterestStatusChangedPayload) {}
}
