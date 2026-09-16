export type EmailMessage = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export interface EmailSender {
  /** Returns the provider's message id (or a preview URL for test providers), if any. */
  send(message: EmailMessage): Promise<string | null>;
}

export const EMAIL_SENDER = Symbol('EmailSender');
