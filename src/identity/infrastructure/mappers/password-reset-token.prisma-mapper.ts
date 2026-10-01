import { PasswordResetTokenEntity } from '../../domain/entities/password-reset-token.entity';

export class PrismaPasswordResetTokenMapper {
  static toDomain(record: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }): PasswordResetTokenEntity {
    return new PasswordResetTokenEntity(
      record.id,
      record.userId,
      record.tokenHash,
      record.expiresAt,
      record.usedAt,
      record.createdAt,
    );
  }

  static toPersistenceSave(token: PasswordResetTokenEntity): {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  } {
    return {
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      usedAt: token.usedAt,
      createdAt: token.createdAt,
    };
  }
}
