import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard to validate Twilio webhook signatures.
 * Prevents unauthorized requests from being processed.
 *
 * TODO: Implement Twilio signature validation
 * Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
@Injectable()
export class TwilioWebhookGuard implements CanActivate {
  private readonly logger = new Logger(TwilioWebhookGuard.name);
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.webhookSecret =
      this.config.get<string>('TWILIO_WEBHOOK_SECRET') || '';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-twilio-signature'];
    const url = this.getFullUrl(request);
    const params = request.body;

    // If no secret is configured, skip validation (development mode)
    // This allows local testing without Twilio signature validation
    if (!this.webhookSecret) {
      this.logger.warn(
        'TWILIO_WEBHOOK_SECRET not configured. Webhook validation is disabled. ' +
        'This is OK for development, but should be configured in production.',
      );
      return true;
    }

    if (!signature) {
      this.logger.warn('Missing x-twilio-signature header');
      throw new UnauthorizedException('Missing webhook signature');
    }

    try {
      // Dynamic import to avoid requiring twilio at build time if not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      const validator = new twilio.webhook.Webhook(this.webhookSecret);
      
      // Twilio expects the full URL including protocol and host
      const isValid = validator.validate(signature, url, params);

      if (!isValid) {
        this.logger.warn('Invalid Twilio webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }

      return true;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      this.logger.error('Error validating Twilio webhook signature', error);
      // In case of validation errors, reject for security
      throw new UnauthorizedException('Webhook validation failed');
    }
  }

  /**
   * Get the full URL for signature validation.
   * Twilio requires the full URL including protocol and host.
   */
  private getFullUrl(request: any): string {
    const protocol = request.protocol || 'http';
    const host = request.get('host');
    const originalUrl = request.originalUrl || request.url;
    
    return `${protocol}://${host}${originalUrl}`;
  }
}

