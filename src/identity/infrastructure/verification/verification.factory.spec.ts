import { verificationServiceProvider } from './verification.factory';
import { LocalVerificationService } from './local-verification.service';
import { TwilioVerifyService } from './twilio-verify.service';

describe('verificationServiceProvider', () => {
  const factory = (verificationServiceProvider as any).useFactory as (
    config: any,
    twilioClientService: any,
  ) => any;
  const mockTwilioClientService = { getClient: jest.fn() } as any;

  const makeConfig = (value?: string) => ({
    get: jest.fn((_key: string, def?: string) =>
      value !== undefined ? value : def,
    ),
  });

  it("returns LocalVerificationService when VERIFICATION_PROVIDER='local'", () => {
    const result = factory(makeConfig('local'), mockTwilioClientService);

    expect(result).toBeInstanceOf(LocalVerificationService);
  });

  it("returns TwilioVerifyService when VERIFICATION_PROVIDER='twilio'", () => {
    const result = factory(makeConfig('twilio'), mockTwilioClientService);

    expect(result).toBeInstanceOf(TwilioVerifyService);
  });

  it('defaults to TwilioVerifyService when VERIFICATION_PROVIDER is unset (production must never silently go fake)', () => {
    const config = makeConfig(undefined);

    const result = factory(config, mockTwilioClientService);

    expect(result).toBeInstanceOf(TwilioVerifyService);
    expect(config.get).toHaveBeenCalledWith('VERIFICATION_PROVIDER', 'twilio');
  });

  it('defaults to TwilioVerifyService for an unrecognized value', () => {
    const result = factory(
      makeConfig('carrier-pigeon'),
      mockTwilioClientService,
    );

    expect(result).toBeInstanceOf(TwilioVerifyService);
  });
});
