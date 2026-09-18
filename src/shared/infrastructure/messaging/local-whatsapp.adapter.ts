import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhatsAppMessagingPort } from '../../domain/ports/whatsapp-messaging.port';

/**
 * Local (no-Twilio) WhatsApp adapter for development and testing.
 *
 * Never makes a network call: it logs the outgoing message and immediately
 * returns a synthetic message id. Used when WHATSAPP_PROVIDER=local, so
 * developers can exercise the full follow-up / conversation flow without a
 * Twilio account. Never selected by default (see whatsapp-messaging.factory.ts
 * and whatsapp-dev-mode.ts) so production never silently goes fake.
 */
@Injectable()
export class LocalWhatsAppAdapter implements WhatsAppMessagingPort {
  private readonly logger = new Logger(LocalWhatsAppAdapter.name);

  async sendMessage(
    to: string,
    message: string,
  ): Promise<{ messageId: string }> {
    const messageId = `local-${randomUUID()}`;

    this.logger.log(
      `[LOCAL WHATSAPP] To=${to}, MessageId=${messageId}, Body="${message}"`,
    );

    return { messageId };
  }

  async getMessageStatus(messageId: string): Promise<{ status: string }> {
    this.logger.debug(
      `[LOCAL WHATSAPP] getMessageStatus MessageId=${messageId} -> delivered`,
    );
    return { status: 'delivered' };
  }
}
