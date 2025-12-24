import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailMessage, EmailSender } from '../../domain/ports/email-sender';

interface MailgunResponse {
  id: string;
  message: string;
}

@Injectable()
export class MailgunEmailSender implements EmailSender {
  private readonly logger = new Logger(MailgunEmailSender.name);
  private readonly apiKey: string;
  private readonly domain: string;
  private readonly from: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('MAILGUN_API_KEY') || '';
    this.domain = this.config.get<string>('MAILGUN_DOMAIN') || '';
    this.from =
      this.config.get<string>('MAILGUN_FROM') ||
      this.config.get<string>('NOTIFICATIONS_SMTP_FROM') ||
      '';

    // Use EU endpoint if domain ends with .eu or env var is set
    const region = this.config.get<string>('MAILGUN_REGION', 'us');
    this.baseUrl =
      region === 'eu'
        ? 'https://api.eu.mailgun.net/v3'
        : 'https://api.mailgun.net/v3';
  }

  async send(message: EmailMessage): Promise<void> {
    this.validateConfig();
    this.validateMessage(message);

    const formData = new URLSearchParams();
    formData.append('from', this.from);
    formData.append('to', message.to);
    formData.append('subject', message.subject);

    if (message.html) {
      formData.append('html', message.html);
    }
    if (message.text) {
      formData.append('text', message.text);
    }

    const url = `${this.baseUrl}/${this.domain}/messages`;
    const auth = Buffer.from(`api:${this.apiKey}`).toString('base64');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Mailgun API error: ${response.status} - ${errorText}`,
        );
      }

      const result: MailgunResponse = await response.json();
      this.logger.log(`Email sent via Mailgun: ${result.id}`);
    } catch (error) {
      this.logger.error(`Failed to send email via Mailgun: ${error}`);
      throw error;
    }
  }

  private validateConfig(): void {
    if (!this.apiKey) {
      throw new Error('MAILGUN_API_KEY is not configured');
    }
    if (!this.domain) {
      throw new Error('MAILGUN_DOMAIN is not configured');
    }
    if (!this.from) {
      throw new Error('MAILGUN_FROM or NOTIFICATIONS_SMTP_FROM is not configured');
    }
  }

  private validateMessage(message: EmailMessage): void {
    if (message.text == null && message.html == null) {
      throw new Error('Email message must include text or html');
    }
  }
}

