/**
 * DTO for Twilio webhook payload.
 * Based on Twilio's webhook format for WhatsApp messages.
 */
export class TwilioWebhookDto {
  // Message identification
  MessageSid?: string;
  AccountSid?: string;

  // Message content (for inbound messages)
  From?: string; // Phone number in format whatsapp:+5492944123456
  To?: string; // Our Twilio number
  Body?: string; // Message content

  // Status updates
  MessageStatus?: string; // queued, sent, delivered, read, failed, etc.
  ErrorCode?: string;
  ErrorMessage?: string;

  // Additional metadata
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

