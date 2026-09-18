import { whatsAppMessagingProvider } from './whatsapp-messaging.factory';
import { LocalWhatsAppAdapter } from './local-whatsapp.adapter';
import { TwilioWhatsAppAdapter } from './twilio-whatsapp.adapter';

describe('whatsAppMessagingProvider', () => {
  const factory = (whatsAppMessagingProvider as any).useFactory as (
    config: any,
    twilioClientService: any,
  ) => any;
  const mockTwilioClientService = { getClient: jest.fn() } as any;

  const makeConfig = (value?: string) => ({
    get: jest.fn((_key: string, def?: string) =>
      value !== undefined ? value : def,
    ),
  });

  it("returns LocalWhatsAppAdapter when WHATSAPP_PROVIDER='local'", () => {
    const result = factory(makeConfig('local'), mockTwilioClientService);

    expect(result).toBeInstanceOf(LocalWhatsAppAdapter);
  });

  it("returns TwilioWhatsAppAdapter when WHATSAPP_PROVIDER='twilio'", () => {
    const result = factory(makeConfig('twilio'), mockTwilioClientService);

    expect(result).toBeInstanceOf(TwilioWhatsAppAdapter);
  });

  it('defaults to TwilioWhatsAppAdapter when WHATSAPP_PROVIDER is unset (production must never silently go fake)', () => {
    const config = makeConfig(undefined);

    const result = factory(config, mockTwilioClientService);

    expect(result).toBeInstanceOf(TwilioWhatsAppAdapter);
    expect(config.get).toHaveBeenCalledWith('WHATSAPP_PROVIDER', 'twilio');
  });

  it('defaults to TwilioWhatsAppAdapter for an unrecognized value', () => {
    const result = factory(
      makeConfig('carrier-pigeon'),
      mockTwilioClientService,
    );

    expect(result).toBeInstanceOf(TwilioWhatsAppAdapter);
  });
});
