import { RequestStatus, ProviderType } from '@prisma/client';
import { DomainEvent } from '../../../shared/domain/events/domain-event';
import type { ActorKind } from '../entities/request.entity';

export type RequestStatusChangedPayload = {
  requestId: string;
  requestTitle: string;
  clientId: string;
  clientName: string;
  /** @deprecated Use serviceProviderId instead */
  professionalId: string | null;
  /** @deprecated Use providerName instead */
  professionalName: string | null;
  /** The ServiceProvider ID (if assigned) */
  serviceProviderId?: string | null;
  /** The userId of the provider */
  providerUserId?: string | null;
  /** The type of provider */
  providerType?: ProviderType | null;
  /** Display name of the provider */
  providerName?: string | null;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  changedByUserId: string;
  /** Who moved the request (Sistema/Soporte are not users). Absent on legacy publishers. */
  changedByActorKind?: ActorKind | null;
};

export class RequestStatusChangedEvent
  implements DomainEvent<RequestStatusChangedPayload>
{
  public static readonly EVENT_NAME = 'requests.request.status_changed';

  public readonly name = RequestStatusChangedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestStatusChangedPayload) {}
}
