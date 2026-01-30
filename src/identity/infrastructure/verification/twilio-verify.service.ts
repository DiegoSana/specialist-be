import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VerificationService,
} from '../../domain/ports/verification.service';
import { TwilioClientService } from '../../../shared/infrastructure/messaging/twilio-client.service';

/**
 * Twilio Verify service adapter.
 * Implements phone and email verification using Twilio Verify API.
 * Uses the shared TwilioClientService to avoid duplicating client initialization.
 *
 * Environment variables required:
 * - TWILIO_ACCOUNT_SID (shared via TwilioClientService)
 * - TWILIO_AUTH_TOKEN (shared via TwilioClientService)
 * - TWILIO_VERIFY_SERVICE_SID
 */
@Injectable()
export class TwilioVerifyService implements VerificationService {
  private readonly logger = new Logger(TwilioVerifyService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly twilioClientService: TwilioClientService,
  ) {}

  async requestPhoneVerification(phone: string): Promise<string> {
    const twilioClient = this.twilioClientService.getClient();
    if (!twilioClient) {
      throw new Error('Twilio client is not initialized. Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }

    const serviceSid = this.getServiceSidOrThrow();

    try {
      const verification = await twilioClient.verify.v2
        .services(serviceSid)
        .verifications.create({
          to: phone,
          channel: 'sms',
        });

      this.logger.debug(`Phone verification requested for ${phone}`);
      return verification.sid;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const errorCode = error.code || 'UNKNOWN';
      
      this.logger.error(
        `Failed to request phone verification for ${phone}`,
        `Code: ${errorCode}, Message: ${errorMessage}`,
      );

      // Handle specific Twilio error cases
      if (errorCode === 20003 || errorMessage.includes('Test Account Credentials')) {
        throw new Error(
          'Twilio test credentials cannot send. Please use production credentials or verify the phone number in Twilio console.',
        );
      }

      if (errorCode === 60200) {
        throw new Error('Invalid phone number format');
      }

      if (errorCode === 60203) {
        throw new Error('Maximum number of attempts reached. Please try again later.');
      }

      // Generic error with more context
      throw new Error(`Failed to send verification code: ${errorMessage} (Code: ${errorCode})`);
    }
  }

  async confirmPhoneVerification(
    phone: string,
    code: string,
  ): Promise<boolean> {
    const twilioClient = this.twilioClientService.getClient();
    if (!twilioClient) {
      this.logger.error('Twilio client is not initialized');
      return false;
    }

    const serviceSid = this.getServiceSidOrThrow();

    try {
      const verificationCheck = await twilioClient.verify.v2
        .services(serviceSid)
        .verificationChecks.create({
          to: phone,
          code: code,
        });

      const isValid = verificationCheck.status === 'approved';
      this.logger.debug(
        `Phone verification ${isValid ? 'succeeded' : 'failed'} for ${phone}`,
      );
      return isValid;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const errorCode = error.code || 'UNKNOWN';
      
      this.logger.error(
        `Failed to confirm phone verification for ${phone}`,
        `Code: ${errorCode}, Message: ${errorMessage}`,
      );
      
      // Return false for invalid codes, but log the specific error
      return false;
    }
  }

  async requestEmailVerification(email: string): Promise<string> {
    const twilioClient = this.twilioClientService.getClient();
    if (!twilioClient) {
      throw new Error('Twilio client is not initialized. Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }

    const serviceSid = this.getServiceSidOrThrow();

    try {
      const verification = await twilioClient.verify.v2
        .services(serviceSid)
        .verifications.create({
          to: email,
          channel: 'email',
        });

      this.logger.debug(`Email verification requested for ${email}`);
      return verification.sid;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const errorCode = error.code || 'UNKNOWN';
      
      this.logger.error(
        `Failed to request email verification for ${email}`,
        `Code: ${errorCode}, Message: ${errorMessage}`,
      );

      // Handle specific Twilio error cases
      if (errorCode === 20003 || errorMessage.includes('Test Account Credentials')) {
        throw new Error(
          'Twilio test credentials cannot send real emails. Please use production credentials.',
        );
      }

      if (errorCode === 60200) {
        throw new Error('Invalid email format');
      }

      if (errorCode === 60203) {
        throw new Error('Maximum number of attempts reached. Please try again later.');
      }

      // Generic error with more context
      throw new Error(`Failed to send verification code: ${errorMessage} (Code: ${errorCode})`);
    }
  }

  async confirmEmailVerification(email: string, code: string): Promise<boolean> {
    const twilioClient = this.twilioClientService.getClient();
    if (!twilioClient) {
      this.logger.error('Twilio client is not initialized');
      return false;
    }

    const serviceSid = this.getServiceSidOrThrow();

    try {
      const verificationCheck = await twilioClient.verify.v2
        .services(serviceSid)
        .verificationChecks.create({
          to: email,
          code: code,
        });

      const isValid = verificationCheck.status === 'approved';
      this.logger.debug(
        `Email verification ${isValid ? 'succeeded' : 'failed'} for ${email}`,
      );
      return isValid;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const errorCode = error.code || 'UNKNOWN';
      
      this.logger.error(
        `Failed to confirm email verification for ${email}`,
        `Code: ${errorCode}, Message: ${errorMessage}`,
      );
      
      // Return false for invalid codes, but log the specific error
      return false;
    }
  }

  private getServiceSidOrThrow(): string {
    const serviceSid = this.config.get<string>('TWILIO_VERIFY_SERVICE_SID');
    if (!serviceSid) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID is not configured');
    }
    return serviceSid;
  }
}

