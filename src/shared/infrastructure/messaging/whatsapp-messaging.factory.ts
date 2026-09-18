import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WHATSAPP_MESSAGING_PORT,
  WhatsAppMessagingPort,
} from '../../domain/ports/whatsapp-messaging.port';
import { TwilioWhatsAppAdapter } from './twilio-whatsapp.adapter';
import { LocalWhatsAppAdapter } from './local-whatsapp.adapter';
import { TwilioClientService } from './twilio-client.service';

export type WhatsAppProviderType = 'twilio' | 'local';

/**
 * Factory provider that creates the appropriate WhatsAppMessagingPort
 * based on the WHATSAPP_PROVIDER environment variable.
 *
 * - 'twilio' (default): Uses real Twilio WhatsApp API. Production must never
 *   silently fall back to the local adapter, so this is the default when the
 *   env var is unset.
 * - 'local': Uses LocalWhatsAppAdapter (no network call, for dev/testing).
 */
export const whatsAppMessagingProvider: Provider = {
  provide: WHATSAPP_MESSAGING_PORT,
  useFactory: (
    config: ConfigService,
    twilioClientService: TwilioClientService,
  ): WhatsAppMessagingPort => {
    const provider = config.get<WhatsAppProviderType>(
      'WHATSAPP_PROVIDER',
      'twilio',
    );

    switch (provider) {
      case 'local':
        return new LocalWhatsAppAdapter();
      case 'twilio':
      default:
        return new TwilioWhatsAppAdapter(config, twilioClientService);
    }
  },
  inject: [ConfigService, TwilioClientService],
};
