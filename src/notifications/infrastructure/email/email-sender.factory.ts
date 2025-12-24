import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SENDER, EmailSender } from '../../domain/ports/email-sender';
import { SmtpEmailSender } from './smtp-email-sender';
import { MailgunEmailSender } from './mailgun-email-sender';

export type EmailProviderType = 'smtp' | 'mailgun';

/**
 * Factory provider that creates the appropriate EmailSender
 * based on EMAIL_PROVIDER environment variable.
 *
 * - 'smtp' (default): Uses SMTP/Nodemailer (works with Mailpit, Gmail, etc.)
 * - 'mailgun': Uses Mailgun API
 */
export const emailSenderProvider: Provider = {
  provide: EMAIL_SENDER,
  useFactory: (config: ConfigService): EmailSender => {
    const provider = config.get<EmailProviderType>('EMAIL_PROVIDER', 'smtp');

    switch (provider) {
      case 'mailgun':
        return new MailgunEmailSender(config);
      case 'smtp':
      default:
        return new SmtpEmailSender(config);
    }
  },
  inject: [ConfigService],
};

