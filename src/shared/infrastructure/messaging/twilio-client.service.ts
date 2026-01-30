import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Shared Twilio client service.
 * Centralizes Twilio client initialization to avoid duplication.
 * 
 * This service provides a singleton Twilio client instance that can be
 * used by different services (Verify, Messaging, etc.).
 */
@Injectable()
export class TwilioClientService implements OnModuleInit {
  private readonly logger = new Logger(TwilioClientService.name);
  private twilioClient: any;
  private readonly accountSid: string | undefined;
  private readonly authToken: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    this.authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
  }

  onModuleInit() {
    this.initializeTwilio();
  }

  private initializeTwilio(): void {
    if (!this.accountSid || !this.authToken) {
      this.logger.warn(
        'Twilio credentials not configured. TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required.',
      );
      return;
    }

    try {
      // Dynamic import to avoid requiring twilio at build time if not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      this.twilioClient = twilio(this.accountSid, this.authToken);
      this.logger.log('Twilio client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Twilio client', error);
    }
  }

  /**
   * Get the Twilio client instance.
   * @returns Twilio client or null if not initialized
   */
  getClient(): any {
    if (!this.twilioClient) {
      this.logger.warn(
        'Twilio client is not initialized. Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
      );
    }
    return this.twilioClient;
  }

  /**
   * Check if Twilio client is initialized.
   */
  isInitialized(): boolean {
    return !!this.twilioClient;
  }
}

