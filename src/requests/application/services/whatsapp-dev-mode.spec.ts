import { isWhatsAppDevMode } from './whatsapp-dev-mode';

describe('isWhatsAppDevMode', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const makeConfig = (
    values: {
      WHATSAPP_PROVIDER?: string;
      WHATSAPP_DEV_MODE_ENABLED?: string;
    } = {},
  ) =>
    ({
      get: jest.fn((key: string, def?: string) =>
        key in values ? (values as any)[key] : def,
      ),
    }) as any;

  it('returns true when NODE_ENV is not production and WHATSAPP_PROVIDER=local', () => {
    process.env.NODE_ENV = 'development';

    expect(isWhatsAppDevMode(makeConfig({ WHATSAPP_PROVIDER: 'local' }))).toBe(
      true,
    );
  });

  it('returns false when NODE_ENV is not production and WHATSAPP_PROVIDER=twilio', () => {
    process.env.NODE_ENV = 'development';

    expect(isWhatsAppDevMode(makeConfig({ WHATSAPP_PROVIDER: 'twilio' }))).toBe(
      false,
    );
  });

  it('returns false when NODE_ENV is production and WHATSAPP_PROVIDER=local, with no override', () => {
    process.env.NODE_ENV = 'production';

    expect(isWhatsAppDevMode(makeConfig({ WHATSAPP_PROVIDER: 'local' }))).toBe(
      false,
    );
  });

  it('returns false when NODE_ENV is production and WHATSAPP_PROVIDER=twilio', () => {
    process.env.NODE_ENV = 'production';

    expect(isWhatsAppDevMode(makeConfig({ WHATSAPP_PROVIDER: 'twilio' }))).toBe(
      false,
    );
  });

  it('defaults WHATSAPP_PROVIDER to twilio when unset, so dev mode is off by default', () => {
    process.env.NODE_ENV = 'development';

    expect(isWhatsAppDevMode(makeConfig())).toBe(false);
  });

  it('returns true when NODE_ENV is production but WHATSAPP_DEV_MODE_ENABLED=true and WHATSAPP_PROVIDER=local', () => {
    process.env.NODE_ENV = 'production';

    expect(
      isWhatsAppDevMode(
        makeConfig({
          WHATSAPP_PROVIDER: 'local',
          WHATSAPP_DEV_MODE_ENABLED: 'true',
        }),
      ),
    ).toBe(true);
  });

  it('returns false when NODE_ENV is production, WHATSAPP_DEV_MODE_ENABLED=true, but WHATSAPP_PROVIDER=twilio', () => {
    process.env.NODE_ENV = 'production';

    expect(
      isWhatsAppDevMode(
        makeConfig({
          WHATSAPP_PROVIDER: 'twilio',
          WHATSAPP_DEV_MODE_ENABLED: 'true',
        }),
      ),
    ).toBe(false);
  });

  it('returns false when NODE_ENV is production, WHATSAPP_PROVIDER=local, but WHATSAPP_DEV_MODE_ENABLED is not exactly "true"', () => {
    process.env.NODE_ENV = 'production';

    expect(
      isWhatsAppDevMode(
        makeConfig({
          WHATSAPP_PROVIDER: 'local',
          WHATSAPP_DEV_MODE_ENABLED: 'yes',
        }),
      ),
    ).toBe(false);
  });
});
