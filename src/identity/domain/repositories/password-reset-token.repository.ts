import { PasswordResetTokenEntity } from '../entities/password-reset-token.entity';

export interface PasswordResetTokenRepository {
  save(token: PasswordResetTokenEntity): Promise<PasswordResetTokenEntity>;

  /**
   * Returns the token row only if it exists, is not used and has not expired yet.
   * Returns null otherwise (not found, already used, or expired) — callers never need to
   * distinguish why, they just treat it as "invalid or expired".
   */
  findValidByTokenHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenEntity | null>;

  /**
   * Marks every outstanding (unused) token for this user as used, so a new reset request or a
   * completed reset invalidates any other tokens still in flight for that user.
   */
  invalidateAllForUser(userId: string): Promise<void>;

  markUsed(id: string): Promise<void>;
}

// Token for dependency injection
export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol(
  'PasswordResetTokenRepository',
);
