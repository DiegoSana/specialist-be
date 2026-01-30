import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Rate limiting guard for Twilio webhooks.
 * Prevents abuse by limiting requests per IP address.
 */
@Injectable()
export class TwilioRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(TwilioRateLimitGuard.name);
  
  // In-memory store for rate limiting (in production, consider using Redis)
  private readonly requestCounts = new Map<string, { count: number; resetAt: number }>();
  
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(private readonly config: ConfigService) {
    // Default: 100 requests per minute per IP
    this.maxRequests = parseInt(
      this.config.get<string>('TWILIO_WEBHOOK_RATE_LIMIT_MAX') || '100',
      10,
    );
    this.windowMs = parseInt(
      this.config.get<string>('TWILIO_WEBHOOK_RATE_LIMIT_WINDOW_MS') || '60000',
      10,
    );

    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = this.getClientIp(request);
    const now = Date.now();

    this.logger.debug(`Rate limit check for IP: ${ip}`);

    // Get or create rate limit entry for this IP
    const entry = this.requestCounts.get(ip);

    if (!entry || entry.resetAt < now) {
      // First request or window expired - reset counter
      this.requestCounts.set(ip, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      this.logger.debug(`Rate limit passed for IP: ${ip} (first request or window expired)`);
      return true;
    }

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      this.logger.warn(
        `Rate limit exceeded for IP ${ip}: ${entry.count}/${this.maxRequests} requests in window`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000), // seconds
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    entry.count++;
    this.requestCounts.set(ip, entry);

    this.logger.debug(`Rate limit passed for IP: ${ip} (count: ${entry.count}/${this.maxRequests})`);
    return true;
  }

  /**
   * Get client IP address from request.
   * Handles proxies and load balancers.
   */
  private getClientIp(request: any): string {
    // Check for forwarded IP (from proxy/load balancer)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwarded.split(',')[0].trim();
    }

    // Check for real IP header
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // Fallback to connection remote address
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [ip, entry] of this.requestCounts.entries()) {
      if (entry.resetAt < now) {
        this.requestCounts.delete(ip);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }
}

