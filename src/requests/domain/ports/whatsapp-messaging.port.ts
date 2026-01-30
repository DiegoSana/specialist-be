/**
 * Port for WhatsApp messaging.
 * This abstraction allows swapping implementations (Twilio, other providers) without changing domain code.
 * 
 * The port is provider-agnostic - it doesn't mention Twilio in the interface.
 * The implementation (adapter) can use Twilio, another provider, or a mock for testing.
 */
export interface WhatsAppMessagingPort {
  /**
   * Send a WhatsApp message.
   * @param to Phone number in E.164 format (e.g., +5492944123456)
   * @param message Text content of the message
   * @returns Promise resolving to the message ID (provider-specific)
   * @throws Error if message cannot be sent
   */
  sendMessage(to: string, message: string): Promise<{ messageId: string }>;

  /**
   * Get the status of a message by its ID.
   * @param messageId Provider-specific message ID
   * @returns Promise resolving to message status
   */
  getMessageStatus(messageId: string): Promise<{ status: string }>;
}

// Token for dependency injection
export const WHATSAPP_MESSAGING_PORT = Symbol('WhatsAppMessagingPort');

