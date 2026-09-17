export type EmailMessage = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export type EmailProviderStatus = {
  provider: 'smtp' | 'mailgun' | 'ethereal';
  ethereal?: { loginUrl: string; user: string; pass: string };
};

export interface EmailSender {
  /** Returns the provider's message id (or a preview URL for test providers), if any. */
  send(message: EmailMessage): Promise<string | null>;
  /** Describes the currently active provider (and, for Ethereal, its live login credentials). */
  describe(): Promise<EmailProviderStatus>;
}

export const EMAIL_SENDER = Symbol('EmailSender');
