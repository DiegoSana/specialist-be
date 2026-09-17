import { ResponseIntent } from '@prisma/client';
import { DomainEvent } from '../../../shared/domain/events/domain-event';
import { RequestViabilitySignal } from '../ports/intent-detection.port';

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
  /** Confidence (0..1) behind responseIntent, from the classifier. */
  confidence: number;
  /** Signal that this request may be going nowhere, from the classifier. */
  viability: RequestViabilitySignal;
  /** Whether this reply asked to stop receiving WhatsApp messages. */
  optOut: boolean;
  /** Whether this reply needs human/admin attention beyond the normal status flow. */
  escalate: boolean;
};

export class RequestInteractionRespondedEvent
  implements DomainEvent<RequestInteractionRespondedPayload>
{
  public static readonly EVENT_NAME = 'requests.interaction.responded';

  public readonly name = RequestInteractionRespondedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: RequestInteractionRespondedPayload) {}
}
