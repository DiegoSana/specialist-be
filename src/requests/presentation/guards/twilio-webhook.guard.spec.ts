import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import * as twilio from 'twilio';
import { TwilioWebhookGuard } from './twilio-webhook.guard';

describe('TwilioWebhookGuard', () => {
  const AUTH_TOKEN = 'test-auth-token';
  const HOST = 'specialist-api.fly.dev';
  const PATH = '/api/webhooks/twilio';
  const PARAMS = { MessageSid: 'SM123', MessageStatus: 'delivered' };

  let mockConfig: any;
  let guard: TwilioWebhookGuard;

  const buildRequest = (overrides: Record<string, any> = {}) => ({
    protocol: 'https',
    get: (name: string) => (name.toLowerCase() === 'host' ? HOST : undefined),
    originalUrl: PATH,
    headers: {},
    body: PARAMS,
    ...overrides,
  });

  const buildContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  const signFor = (url: string) =>
    twilio.getExpectedTwilioSignature(AUTH_TOKEN, url, PARAMS);

  beforeEach(() => {
    mockConfig = {
      get: jest.fn().mockReturnValue(AUTH_TOKEN),
    };
    guard = new TwilioWebhookGuard(mockConfig);
  });

  it('should accept a request whose signature was computed against the https URL Twilio actually called (forwarded-https request, matching the trust-proxy-fixed req.protocol)', () => {
    const httpsUrl = `https://${HOST}${PATH}`;
    const signature = signFor(httpsUrl);
    const request = buildRequest({
      protocol: 'https', // what req.protocol resolves to once `trust proxy` honors X-Forwarded-Proto
      headers: { 'x-twilio-signature': signature },
    });

    expect(guard.canActivate(buildContext(request))).toBe(true);
  });

  it('should reject a signature computed against the https URL when the guard reconstructs an http URL instead (the pre-fix bug: req.protocol defaults to "http" behind an untrusted proxy)', () => {
    const httpsUrl = `https://${HOST}${PATH}`;
    const signatureTwilioActuallySent = signFor(httpsUrl);
    const request = buildRequest({
      protocol: 'http', // simulates Express without `trust proxy` set on Fly
      headers: { 'x-twilio-signature': signatureTwilioActuallySent },
    });

    expect(() => guard.canActivate(buildContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('should reject a request with an invalid signature', () => {
    const request = buildRequest({
      headers: { 'x-twilio-signature': 'not-a-real-signature' },
    });

    expect(() => guard.canActivate(buildContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('should reject a request missing the signature header', () => {
    const request = buildRequest({ headers: {} });

    expect(() => guard.canActivate(buildContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('should bypass validation (dev mode) when no webhook secret is configured', () => {
    mockConfig.get.mockReturnValue(undefined);
    guard = new TwilioWebhookGuard(mockConfig);
    const request = buildRequest({ headers: {} });

    expect(guard.canActivate(buildContext(request))).toBe(true);
  });
});
