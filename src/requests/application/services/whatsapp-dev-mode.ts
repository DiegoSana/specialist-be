import { ConfigService } from '@nestjs/config';

/**
 * Single safety-critical check gating dev-only WhatsApp admin operations
 * (simulating an inbound reply, force-triggering a follow-up rule).
 *
 * Dev mode is on ONLY when both:
 * - NODE_ENV is not 'production' (belt-and-suspenders on top of the routing-level
 *   gate that removes the dev controller entirely in production - see requests.module.ts).
 * - WHATSAPP_PROVIDER is explicitly 'local' (so a non-production environment
 *   pointed at a real/staging Twilio backend does NOT expose dev endpoints).
 */
export function isWhatsAppDevMode(config: ConfigService): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    config.get<string>('WHATSAPP_PROVIDER', 'twilio') === 'local'
  );
}
