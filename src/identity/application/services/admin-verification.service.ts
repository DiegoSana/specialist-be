import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerificationProviderType } from '../../infrastructure/verification/verification.factory';

// Mirrors LocalVerificationService.DEV_CODE (local-verification.service.ts), which isn't
// imported from here: application/ must not depend on infrastructure/ (same convention
// AdminWhatsAppService follows for DEFAULT_SANDBOX_WHATSAPP_FROM). Keep the two literals in sync.
const DEV_CODE = '000000';

export interface AdminVerificationConfig {
  provider: VerificationProviderType;
  devCode?: string;
}

/**
 * Admin service backing the "Phone/email verification" settings card: reports the active
 * VERIFICATION_PROVIDER (twilio/local) and, when it's local, the fixed dev OTP code every
 * confirm* call accepts - mirrors AdminWhatsAppService.getConfig.
 */
@Injectable()
export class AdminVerificationService {
  constructor(private readonly config: ConfigService) {}

  getConfig(): AdminVerificationConfig {
    const provider = this.config.get<VerificationProviderType>(
      'VERIFICATION_PROVIDER',
      'twilio',
    );

    return {
      provider,
      devCode: provider === 'local' ? DEV_CODE : undefined,
    };
  }
}
