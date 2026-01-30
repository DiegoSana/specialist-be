import { Module } from '@nestjs/common';
import { TwilioClientService } from './twilio-client.service';
import { MessageTemplateService } from './message-template.service';

/**
 * Shared messaging infrastructure module.
 * Provides Twilio client service and message templates for use across bounded contexts.
 */
@Module({
  providers: [TwilioClientService, MessageTemplateService],
  exports: [TwilioClientService, MessageTemplateService],
})
export class MessagingModule {}

