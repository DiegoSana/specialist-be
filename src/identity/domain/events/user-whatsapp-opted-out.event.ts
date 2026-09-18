import { DomainEvent } from '../../../shared/domain/events/domain-event';

export interface UserWhatsAppOptedOutPayload {
  userId: string;
}

/**
 * Published when a user transitions into whatsappOptedOut=true (false -> true only; clearing
 * the flag does not publish an event). Two producers funnel through UserService.setWhatsAppOptedOut:
 * the WhatsApp reply classifier (RequestInteractionService.recordWhatsAppOptOut) and the admin
 * manual override (UserService.updateWhatsAppOptOutForUser). Consumed by the Notifications context
 * (see UserWhatsAppOptedOutHandler) to tell the user they were opted out, since WhatsApp - the
 * usual external channel for this notification - is unavailable to them by definition.
 */
export class UserWhatsAppOptedOutEvent
  implements DomainEvent<UserWhatsAppOptedOutPayload>
{
  public static readonly EVENT_NAME = 'identity.user.whatsapp_opted_out';

  public readonly name = UserWhatsAppOptedOutEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: UserWhatsAppOptedOutPayload) {}
}
