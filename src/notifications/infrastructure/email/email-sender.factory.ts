import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SENDER, EmailSender } from '../../domain/ports/email-sender';
import { SmtpEmailSender } from './smtp-email-sender';
import { MailgunEmailSender } from './mailgun-email-sender';
import { EtherealEmailSender } from './ethereal-email-sender';

export type EmailProviderType = 'smtp' | 'mailgun' | 'ethereal';

/**
 * Factory provider that creates the appropriate EmailSender
 * based on EMAIL_PROVIDER environment variable.
 *
 * - 'smtp' (default): Uses SMTP/Nodemailer (works with Mailpit, Gmail, etc.)
 * - 'mailgun': Uses Mailgun API
 * - 'ethereal': Dynamically-provisioned Ethereal (ethereal.email) test SMTP account
 *   (nodemailer.createTestAccount()) - fake SMTP, nothing is really delivered, no config
 *   needed. Pre-launch Fly.io testing deploy only, see fly.toml.
 */
export const emailSenderProvider: Provider = {
  provide: EMAIL_SENDER,
  useFactory: (config: ConfigService): EmailSender => {
    const provider = config.get<EmailProviderType>('EMAIL_PROVIDER', 'smtp');

    switch (provider) {
      case 'mailgun':
        return new MailgunEmailSender(config);
      case 'ethereal':
        return new EtherealEmailSender(config);
      case 'smtp':
      default:
        return new SmtpEmailSender(config);
    }
  },
  inject: [ConfigService],
};
