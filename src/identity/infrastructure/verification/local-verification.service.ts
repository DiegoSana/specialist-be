import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VerificationService } from '../../domain/ports/verification.service';

/**
 * Local (no-Twilio) verification adapter for development and testing.
 *
 * Never makes a network call: it logs the outgoing OTP request and always accepts back a fixed
 * development code, so a phone/email can be verified without a Twilio Verify account and without
 * having to read logs to find the "real" code. Used when VERIFICATION_PROVIDER=local. Never
 * selected by default (see verification.factory.ts) so production never silently goes fake.
 */
@Injectable()
export class LocalVerificationService implements VerificationService {
  private readonly logger = new Logger(LocalVerificationService.name);

  /** Accepted by every confirm* call when VERIFICATION_PROVIDER=local. */
  static readonly DEV_CODE = '000000';

  async requestPhoneVerification(phone: string): Promise<string> {
    const sessionId = `local-${randomUUID()}`;
    this.logger.log(
      `[LOCAL VERIFICATION] Phone=${phone}, Code=${LocalVerificationService.DEV_CODE}, SessionId=${sessionId}`,
    );
    return sessionId;
  }

  async confirmPhoneVerification(
    phone: string,
    code: string,
  ): Promise<boolean> {
    const isValid = code === LocalVerificationService.DEV_CODE;
    this.logger.debug(
      `[LOCAL VERIFICATION] confirmPhoneVerification Phone=${phone} -> ${isValid ? 'approved' : 'rejected'}`,
    );
    return isValid;
  }

  async requestEmailVerification(email: string): Promise<string> {
    const sessionId = `local-${randomUUID()}`;
    this.logger.log(
      `[LOCAL VERIFICATION] Email=${email}, Code=${LocalVerificationService.DEV_CODE}, SessionId=${sessionId}`,
    );
    return sessionId;
  }

  async confirmEmailVerification(
    email: string,
    code: string,
  ): Promise<boolean> {
    const isValid = code === LocalVerificationService.DEV_CODE;
    this.logger.debug(
      `[LOCAL VERIFICATION] confirmEmailVerification Email=${email} -> ${isValid ? 'approved' : 'rejected'}`,
    );
    return isValid;
  }
}
