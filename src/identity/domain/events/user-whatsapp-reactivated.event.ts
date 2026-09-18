import { DomainEvent } from '../../../shared/domain/events/domain-event';

export interface UserWhatsAppReactivatedPayload {
  userId: string;
}

/**
 * Published when a user transitions out of whatsappOptedOut (true -> false only; setting it to
 * false when it was already false does not publish). Today the only producer is the admin manual
 * override (UserService.updateWhatsAppOptOutForUser) via UserService.setWhatsAppOptedOut — there
 * is no self-service or automatic reactivation path yet. Consumed by the Notifications context
 * (see UserWhatsAppOptedOutHandler) to tell the user WhatsApp coordination is available to them
 * again.
 */
export class UserWhatsAppReactivatedEvent
  implements DomainEvent<UserWhatsAppReactivatedPayload>
{
  public static readonly EVENT_NAME = 'identity.user.whatsapp_reactivated';

  public readonly name = UserWhatsAppReactivatedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: UserWhatsAppReactivatedPayload) {}
}
