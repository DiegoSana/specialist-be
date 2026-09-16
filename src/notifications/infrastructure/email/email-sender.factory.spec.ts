import { emailSenderProvider } from './email-sender.factory';
import { SmtpEmailSender } from './smtp-email-sender';
import { MailgunEmailSender } from './mailgun-email-sender';
import { EtherealEmailSender } from './ethereal-email-sender';

describe('emailSenderProvider', () => {
  const factory = (emailSenderProvider as any).useFactory as (
    config: any,
  ) => any;

  const makeConfig = (value?: string) => ({
    get: jest.fn((_key: string, def?: string) =>
      value !== undefined ? value : def,
    ),
  });

  it("returns SmtpEmailSender when EMAIL_PROVIDER='smtp'", () => {
    expect(factory(makeConfig('smtp'))).toBeInstanceOf(SmtpEmailSender);
  });

  it('defaults to SmtpEmailSender when EMAIL_PROVIDER is unset', () => {
    const config = makeConfig(undefined);

    expect(factory(config)).toBeInstanceOf(SmtpEmailSender);
    expect(config.get).toHaveBeenCalledWith('EMAIL_PROVIDER', 'smtp');
  });

  it("returns MailgunEmailSender when EMAIL_PROVIDER='mailgun'", () => {
    expect(factory(makeConfig('mailgun'))).toBeInstanceOf(MailgunEmailSender);
  });

  it("returns EtherealEmailSender when EMAIL_PROVIDER='ethereal'", () => {
    expect(factory(makeConfig('ethereal'))).toBeInstanceOf(EtherealEmailSender);
  });

  it('defaults to SmtpEmailSender for an unrecognized value', () => {
    expect(factory(makeConfig('carrier-pigeon'))).toBeInstanceOf(
      SmtpEmailSender,
    );
  });
});
