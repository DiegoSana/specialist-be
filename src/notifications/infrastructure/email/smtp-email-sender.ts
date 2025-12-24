import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { EmailMessage, EmailSender } from '../../domain/ports/email-sender';

@Injectable()
export class SmtpEmailSender implements EmailSender {
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(message: EmailMessage): Promise<void> {
    const transporter = this.getOrCreateTransporter();
    const from = this.getFromOrThrow();

    // Note: empty string is a valid "provided" value (dispatcher may fall back to '')
    // Only reject when both fields are truly absent (null/undefined).
    if (message.text == null && message.html == null) {
      throw new Error('Email message must include text or html');
    }

    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private getFromOrThrow(): string {
    const from = this.config.get<string>('NOTIFICATIONS_SMTP_FROM');
    if (!from) {
      throw new Error('NOTIFICATIONS_SMTP_FROM is not configured');
    }
    return from;
  }

  private getOrCreateTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('NOTIFICATIONS_SMTP_HOST');
    const port = Number(
      this.config.get<string>('NOTIFICATIONS_SMTP_PORT', '587'),
    );
    const user = this.config.get<string>('NOTIFICATIONS_SMTP_USER');
    const pass = this.config.get<string>('NOTIFICATIONS_SMTP_PASS');

    if (!host) {
      throw new Error('SMTP is not configured (NOTIFICATIONS_SMTP_HOST)');
    }

    // For local Mailpit: no auth required
    // For Gmail SMTP: host=smtp.gmail.com, port=587, secure=false (STARTTLS)
    const transportOptions: nodemailer.TransportOptions = {
      host,
      port,
      secure: port === 465,
    } as nodemailer.TransportOptions;

    // Only add auth if credentials are provided (Mailpit doesn't need auth)
    if (user && pass) {
      (transportOptions as Record<string, unknown>).auth = { user, pass };
    }

    this.transporter = nodemailer.createTransport(transportOptions);

    return this.transporter;
  }
}
