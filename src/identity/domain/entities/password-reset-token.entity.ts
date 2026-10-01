/**
 * A single-use, time-limited token that authorizes resetting a LOCAL user's password.
 * Immutable like the other aggregates in this context; `markUsed()` returns a new instance.
 */
export class PasswordResetTokenEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    public readonly usedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  static create(params: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    now?: Date;
  }): PasswordResetTokenEntity {
    const now = params.now ?? new Date();
    return new PasswordResetTokenEntity(
      params.id,
      params.userId,
      params.tokenHash,
      params.expiresAt,
      null,
      now,
    );
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }

  isValid(now: Date = new Date()): boolean {
    return !this.isUsed() && !this.isExpired(now);
  }

  markUsed(now: Date = new Date()): PasswordResetTokenEntity {
    return new PasswordResetTokenEntity(
      this.id,
      this.userId,
      this.tokenHash,
      this.expiresAt,
      now,
      this.createdAt,
    );
  }
}
