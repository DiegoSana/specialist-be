import { isWhatsAppDevMode } from './whatsapp-dev-mode';

describe('isWhatsAppDevMode', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const makeConfig = (whatsAppProvider?: string) =>
    ({
      get: jest.fn((_key: string, def?: string) =>
        whatsAppProvider !== undefined ? whatsAppProvider : def,
      ),
    }) as any;

  it('returns true when NODE_ENV is not production and WHATSAPP_PROVIDER=local', () => {
    process.env.NODE_ENV = 'development';

    expect(isWhatsAppDevMode(makeConfig('local'))).toBe(true);
  });

  it('returns false when NODE_ENV is not production and WHATSAPP_PROVIDER=twilio', () => {
    process.env.NODE_ENV = 'development';

    expect(isWhatsAppDevMode(makeConfig('twilio'))).toBe(false);
  });

  it('returns false when NODE_ENV is production and WHATSAPP_PROVIDER=local', () => {
    process.env.NODE_ENV = 'production';

    expect(isWhatsAppDevMode(makeConfig('local'))).toBe(false);
  });

  it('returns false when NODE_ENV is production and WHATSAPP_PROVIDER=twilio', () => {
    process.env.NODE_ENV = 'production';

    expect(isWhatsAppDevMode(makeConfig('twilio'))).toBe(false);
  });

  it('defaults WHATSAPP_PROVIDER to twilio when unset, so dev mode is off by default', () => {
    process.env.NODE_ENV = 'development';

    expect(isWhatsAppDevMode(makeConfig(undefined))).toBe(false);
  });
});
