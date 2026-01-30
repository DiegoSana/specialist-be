import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppMessagingPort } from '../../domain/ports/whatsapp-messaging.port';
import { TwilioClientService } from '../../../shared/infrastructure/messaging/twilio-client.service';

/**
 * Twilio WhatsApp adapter.
 * Implements WhatsApp messaging using Twilio WhatsApp API.
 * Uses the shared TwilioClientService to avoid duplicating client initialization.
 *
 * Environment variables required:
 * - TWILIO_ACCOUNT_SID (shared via TwilioClientService)
 * - TWILIO_AUTH_TOKEN (shared via TwilioClientService)
 * - TWILIO_WHATSAPP_FROM (e.g., whatsapp:+14155238886 for Sandbox)
 * - TWILIO_STATUS_CALLBACK_URL (optional) - If set, will be used for status callbacks per message
 *                                          If not set, uses global Twilio Console configuration
 */
@Injectable()
export class TwilioWhatsAppAdapter implements WhatsAppMessagingPort {
  private readonly logger = new Logger(TwilioWhatsAppAdapter.name);
  private readonly fromNumber: string;

  constructor(
    private readonly config: ConfigService,
    private readonly twilioClientService: TwilioClientService,
  ) {
    this.fromNumber =
      this.config.get<string>('TWILIO_WHATSAPP_FROM') ||
      'whatsapp:+14155238886'; // Default Sandbox number
  }

  async sendMessage(
    to: string,
    message: string,
  ): Promise<{ messageId: string }> {
    const twilioClient = this.twilioClientService.getClient();
    if (!twilioClient) {
      throw new Error(
        'Twilio client is not initialized. Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
      );
    }

    // Ensure phone number is in WhatsApp format
    const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    try {
      // Get status callback URL from config (optional)
      const statusCallback = this.config.get<string>(
        'TWILIO_STATUS_CALLBACK_URL',
      );

      const messageParams: any = {
        from: this.fromNumber,
        to: toWhatsApp,
        body: message,
      };

      // Add status callback if configured
      // If not configured here, it should be set globally in Twilio Console
      if (statusCallback) {
        messageParams.statusCallback = statusCallback;
        messageParams.statusCallbackMethod = 'POST';
      }

      const twilioMessage = await twilioClient.messages.create(messageParams);

      this.logger.debug(
        `WhatsApp message sent to ${toWhatsApp}, SID: ${twilioMessage.sid}`,
      );

      return { messageId: twilioMessage.sid };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const errorCode = error.code || 'UNKNOWN';

      this.logger.error(
        `Failed to send WhatsApp message to ${toWhatsApp}`,
        `Code: ${errorCode}, Message: ${errorMessage}`,
      );

      throw new Error(
        `Failed to send WhatsApp message: ${errorMessage} (Code: ${errorCode})`,
      );
    }
  }

  async getMessageStatus(
    messageId: string,
  ): Promise<{ status: string }> {
    const twilioClient = this.twilioClientService.getClient();
    if (!twilioClient) {
      throw new Error(
        'Twilio client is not initialized. Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
      );
    }

    try {
      const message = await twilioClient.messages(messageId).fetch();
      return { status: message.status };
    } catch (error: any) {
      this.logger.error(
        `Failed to get message status for ID ${messageId}`,
        error,
      );
      throw new Error(`Failed to get message status: ${error.message}`);
    }
  }
}

