import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { PasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository';
import { PasswordResetTokenEntity } from '../../domain/entities/password-reset-token.entity';
import { PrismaPasswordResetTokenMapper } from '../mappers/password-reset-token.prisma-mapper';

@Injectable()
export class PrismaPasswordResetTokenRepository
  implements PasswordResetTokenRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async save(
    token: PasswordResetTokenEntity,
  ): Promise<PasswordResetTokenEntity> {
    const data = PrismaPasswordResetTokenMapper.toPersistenceSave(token);
    const record = await this.prisma.passwordResetToken.upsert({
      where: { id: token.id },
      create: data,
      update: data,
    });
    return PrismaPasswordResetTokenMapper.toDomain(record);
  }

  async findValidByTokenHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenEntity | null> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record) return null;

    const token = PrismaPasswordResetTokenMapper.toDomain(record);
    return token.isValid() ? token : null;
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
