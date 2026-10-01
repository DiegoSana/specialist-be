import { DomainEvent } from '../../../shared/domain/events/domain-event';

export interface PasswordResetOauthOnlyAttemptedPayload {
  userId: string;
  email: string;
  googleLinked: boolean;
  facebookLinked: boolean;
}

/**
 * Published when PasswordResetService.requestReset finds a user for the given email whose
 * `password` is null — an OAuth-only account (Google and/or Facebook linked, see
 * UserEntity.googleId/facebookId) with nothing to reset. No token is issued. Consumed by the
 * Notifications context (PasswordResetRequestedHandler) to explain, by email, that the account
 * signs in via Google/Facebook and has no password. The controller-facing response is identical
 * to the normal "request accepted" case either way (anti-enumeration).
 */
export class PasswordResetOauthOnlyAttemptedEvent
  implements DomainEvent<PasswordResetOauthOnlyAttemptedPayload>
{
  public static readonly EVENT_NAME =
    'identity.user.password_reset_oauth_only_attempted';

  public readonly name = PasswordResetOauthOnlyAttemptedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(
    public readonly payload: PasswordResetOauthOnlyAttemptedPayload,
  ) {}
}
