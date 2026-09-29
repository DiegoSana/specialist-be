import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VERIFICATION_SERVICE,
  VerificationService,
} from '../../domain/ports/verification.service';
import { TwilioVerifyService } from './twilio-verify.service';
import { LocalVerificationService } from './local-verification.service';
import { TwilioClientService } from '../../../shared/infrastructure/messaging/twilio-client.service';

export type VerificationProviderType = 'twilio' | 'local';

/**
 * Factory provider that creates the appropriate VerificationService based on the
 * VERIFICATION_PROVIDER environment variable.
 *
 * - 'twilio' (default): Uses real Twilio Verify (phone SMS + email). Production must never
 *   silently fall back to the local adapter, so this is the default when the env var is unset.
 * - 'local': Uses LocalVerificationService (no network call, fixed dev OTP code, for dev/testing).
 */
export const verificationServiceProvider: Provider = {
  provide: VERIFICATION_SERVICE,
  useFactory: (
    config: ConfigService,
    twilioClientService: TwilioClientService,
  ): VerificationService => {
    const provider = config.get<VerificationProviderType>(
      'VERIFICATION_PROVIDER',
      'twilio',
    );

    switch (provider) {
      case 'local':
        return new LocalVerificationService();
      case 'twilio':
      default:
        return new TwilioVerifyService(config, twilioClientService);
    }
  },
  inject: [ConfigService, TwilioClientService],
};
