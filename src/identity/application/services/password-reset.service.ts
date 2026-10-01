import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash, randomUUID } from 'crypto';
import {
  UserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository';
import {
  PasswordResetTokenRepository,
  PASSWORD_RESET_TOKEN_REPOSITORY,
} from '../../domain/repositories/password-reset-token.repository';
import { PasswordResetTokenEntity } from '../../domain/entities/password-reset-token.entity';
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import { PasswordResetRequestedEvent } from '../../domain/events/password-reset-requested.event';
import { PasswordResetOauthOnlyAttemptedEvent } from '../../domain/events/password-reset-oauth-only-attempted.event';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Always resolves without throwing, regardless of whether the email exists, belongs to an
   * OAuth-only account, or a reset link actually gets sent — anti-enumeration: the controller
   * must look the same from outside in every case.
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return;
    }

    if (!user.password) {
      await this.eventBus.publish(
        new PasswordResetOauthOnlyAttemptedEvent({
          userId: user.id,
          email: user.email,
          googleLinked: !!user.googleId,
          facebookLinked: !!user.facebookId,
        }),
      );
      return;
    }

    await this.passwordResetTokenRepository.invalidateAllForUser(user.id);

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.passwordResetTokenRepository.save(
      PasswordResetTokenEntity.create({
        id: randomUUID(),
        userId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${frontendUrl}/es/reset-password?token=${token}`;

    await this.eventBus.publish(
      new PasswordResetRequestedEvent({
        userId: user.id,
        email: user.email,
        resetUrl,
      }),
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const tokenRow =
      await this.passwordResetTokenRepository.findValidByTokenHash(tokenHash);

    if (!tokenRow) {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.userRepository.findById(tokenRow.userId);
    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user.withPassword(hashedPassword));

    await this.passwordResetTokenRepository.markUsed(tokenRow.id);
    // Hygiene: also invalidate any other outstanding tokens for this user.
    await this.passwordResetTokenRepository.invalidateAllForUser(user.id);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
