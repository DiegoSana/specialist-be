import { Module } from '@nestjs/common';
import { TwilioClientService } from './twilio-client.service';
import { MessageTemplateService } from './message-template.service';
import { whatsAppMessagingProvider } from './whatsapp-messaging.factory';
import { WHATSAPP_MESSAGING_PORT } from '../../domain/ports/whatsapp-messaging.port';

/**
 * Shared messaging infrastructure module.
 * Provides the Twilio client service, message templates, and the
 * WhatsAppMessagingPort (WHATSAPP_MESSAGING_PORT, see whatsapp-messaging.factory.ts)
 * for use across bounded contexts. The port and its adapters (Twilio/local) used to
 * live in requests/ - promoted here so `support` can send WhatsApp messages without
 * depending on the `requests` context.
 */
@Module({
  providers: [
    TwilioClientService,
    MessageTemplateService,
    whatsAppMessagingProvider,
  ],
  exports: [
    TwilioClientService,
    MessageTemplateService,
    WHATSAPP_MESSAGING_PORT,
  ],
})
export class MessagingModule {}
