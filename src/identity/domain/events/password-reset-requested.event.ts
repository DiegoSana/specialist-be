import { DomainEvent } from '../../../shared/domain/events/domain-event';

export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
  resetUrl: string;
}

/**
 * Published when PasswordResetService.requestReset finds a LOCAL user with a password set
 * (i.e. not OAuth-only) for the given email. Consumed by the Notifications context
 * (PasswordResetRequestedHandler) to send the one-time reset link by email immediately, outside
 * the normal NotificationService/dispatch-queue path, since that path would also create an
 * in-app notification carrying the same link (see PasswordResetOauthOnlyAttemptedEvent for the
 * sibling case).
 */
export class PasswordResetRequestedEvent
  implements DomainEvent<PasswordResetRequestedPayload>
{
  public static readonly EVENT_NAME = 'identity.user.password_reset_requested';

  public readonly name = PasswordResetRequestedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: PasswordResetRequestedPayload) {}
}
