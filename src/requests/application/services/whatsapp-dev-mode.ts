import { ConfigService } from '@nestjs/config';

/**
 * Single safety-critical check gating dev-only WhatsApp admin operations
 * (simulating an inbound reply, force-triggering a follow-up rule).
 *
 * WHATSAPP_PROVIDER must always be explicitly 'local' (so an environment pointed at a
 * real/staging Twilio backend never exposes dev endpoints), AND EITHER:
 * - NODE_ENV is not 'production' (the normal case: local/dev), OR
 * - WHATSAPP_DEV_MODE_ENABLED is explicitly 'true' - a deliberate, separate opt-in for a
 *   NODE_ENV=production deploy that is not yet handling real users (e.g. the Fly.io "main"
 *   deploy during pre-launch functional testing, see docs/guides/whatsapp/README.md). This is
 *   kept independent of NODE_ENV on purpose so flipping it back off doesn't require touching
 *   NODE_ENV-gated production behavior elsewhere (Swagger, etc.) - unset it (or leave it unset)
 *   once real WhatsApp/Twilio testing starts.
 */
export function isWhatsAppDevMode(config: ConfigService): boolean {
  if (config.get<string>('WHATSAPP_PROVIDER', 'twilio') !== 'local') {
    return false;
  }

  return (
    process.env.NODE_ENV !== 'production' ||
    config.get<string>('WHATSAPP_DEV_MODE_ENABLED', 'false') === 'true'
  );
}
