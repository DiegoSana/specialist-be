import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import {
  EmailMessage,
  EmailSender,
  EmailProviderStatus,
} from '../../domain/ports/email-sender';

type EtherealTestAccount = {
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
  web: string;
};

/**
 * Dynamically provisions a throwaway Ethereal (ethereal.email) test SMTP account via
 * nodemailer.createTestAccount() - no config, no secrets. Nothing is ever really delivered;
 * every send is viewable at a preview URL (nodemailer.getTestMessageUrl(info)), which this
 * class also returns so the dispatcher can persist it as the delivery's providerMessageId.
 *
 * The account is memoized for the process lifetime (one account per boot), not per send.
 * nodemailer also keeps its own internal test-account cache (ETHEREAL_CACHE), but that's an
 * implementation detail of the library - don't rely on it instead of this class's own memo.
 *
 * getTestMessageUrl() resolves the preview host from a module-global set by the last
 * successful createTestAccount() call (falling back to https://ethereal.email otherwise), not
 * from the specific transporter that sent the mail - a non-issue here since we only ever
 * provision one account per process, but worth knowing if this ever provisions more than one.
 */
@Injectable()
export class EtherealEmailSender implements EmailSender {
  private readonly logger = new Logger(EtherealEmailSender.name);
  private accountPromise: Promise<EtherealTestAccount> | null = null;
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(message: EmailMessage): Promise<string | null> {
    if (message.text == null && message.html == null) {
      throw new Error('Email message must include text or html');
    }

    const account = await this.getOrCreateAccount();
    const transporter = await this.getOrCreateTransporter();
    const from =
      this.config.get<string>('NOTIFICATIONS_SMTP_FROM') || account.user;

    const info = await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      this.logger.log(`[Ethereal] preview: ${previewUrl}`);
    }
    return previewUrl || null;
  }

  async describe(): Promise<EmailProviderStatus> {
    const account = await this.getOrCreateAccount();
    return {
      provider: 'ethereal',
      ethereal: {
        loginUrl: 'https://ethereal.email/login',
        user: account.user,
        pass: account.pass,
      },
    };
  }

  private async getOrCreateAccount(): Promise<EtherealTestAccount> {
    if (!this.accountPromise) {
      this.accountPromise = nodemailer
        .createTestAccount()
        .then((account: EtherealTestAccount) => {
          this.logger.log(
            `[Ethereal] test account ready: ${account.web} (user=${account.user}, pass=${account.pass})`,
          );
          return account;
        })
        .catch((err: unknown) => {
          // Clear the memo so the next send() retries instead of staying broken forever.
          this.accountPromise = null;
          throw err;
        });
    }
    return this.accountPromise;
  }

  private async getOrCreateTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;

    const account = await this.getOrCreateAccount();
    this.transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    } as nodemailer.TransportOptions);

    return this.transporter;
  }
}
