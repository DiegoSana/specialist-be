import { ResponseIntent } from '@prisma/client';
import { DomainEvent } from '../../../shared/domain/events/domain-event';

export type RequestInteractionRespondedPayload = {
  interactionId: string;
  requestId: string;
  responseContent: string;
  responseIntent: ResponseIntent;
  respondedAt: Date;
  /**
   * Time in minutes between when the message was sent and when it was responded.
   * Useful for metrics.
   */
  responseTimeMinutes?: number;
};

export class RequestInteractionRespondedEvent
  implements DomainEvent<RequestInteractionRespondedPayload>
{
  public static readonly EVENT_NAME = 'requests.interaction.responded';

  public readonly name = RequestInteractionRespondedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestInteractionRespondedPayload) {}
}

