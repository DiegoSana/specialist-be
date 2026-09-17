import { EtherealEmailSender } from './ethereal-email-sender';

const mockSendMail = jest.fn();
const mockCreateTestAccount = jest.fn();
const mockGetTestMessageUrl = jest.fn();

jest.mock('nodemailer', () => ({
  createTestAccount: (...args: unknown[]) => mockCreateTestAccount(...args),
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
  getTestMessageUrl: (...args: unknown[]) => mockGetTestMessageUrl(...args),
}));

describe('EtherealEmailSender', () => {
  const makeConfig = (from?: string) =>
    ({
      get: jest.fn(() => from),
    }) as any;

  const account = {
    user: 'jdoe123@ethereal.email',
    pass: 'secret',
    smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
    web: 'https://ethereal.email',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTestAccount.mockResolvedValue(account);
    mockSendMail.mockResolvedValue({ response: '250 OK' });
    mockGetTestMessageUrl.mockReturnValue(
      'https://ethereal.email/message/abc123',
    );
  });

  it('throws when the message has neither text nor html', async () => {
    const sender = new EtherealEmailSender(makeConfig());

    await expect(sender.send({ to: 'a@b.com', subject: 'Hi' })).rejects.toThrow(
      'Email message must include text or html',
    );
    expect(mockCreateTestAccount).not.toHaveBeenCalled();
  });

  it('creates the test account only once across multiple sends', async () => {
    const sender = new EtherealEmailSender(makeConfig());

    await sender.send({ to: 'a@b.com', subject: 'Hi', text: 'hi' });
    await sender.send({ to: 'c@d.com', subject: 'Hi again', text: 'hi' });

    expect(mockCreateTestAccount).toHaveBeenCalledTimes(1);
  });

  it('sends via the provisioned transporter and returns the preview URL', async () => {
    const sender = new EtherealEmailSender(makeConfig());

    const result = await sender.send({
      to: 'a@b.com',
      subject: 'Hi',
      text: 'hi',
      html: '<p>hi</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: account.user,
        to: 'a@b.com',
        subject: 'Hi',
        text: 'hi',
        html: '<p>hi</p>',
      }),
    );
    expect(result).toBe('https://ethereal.email/message/abc123');
  });

  it('uses NOTIFICATIONS_SMTP_FROM as the from address when configured', async () => {
    const sender = new EtherealEmailSender(
      makeConfig('override@specialist.test'),
    );

    await sender.send({ to: 'a@b.com', subject: 'Hi', text: 'hi' });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'override@specialist.test' }),
    );
  });

  it('returns null when getTestMessageUrl finds no preview tag', async () => {
    mockGetTestMessageUrl.mockReturnValue(false);
    const sender = new EtherealEmailSender(makeConfig());

    const result = await sender.send({
      to: 'a@b.com',
      subject: 'Hi',
      text: 'hi',
    });

    expect(result).toBeNull();
  });

  it('describe() lazily creates the account and returns the ethereal status shape', async () => {
    const sender = new EtherealEmailSender(makeConfig());

    const result = await sender.describe();

    expect(mockCreateTestAccount).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      provider: 'ethereal',
      ethereal: {
        loginUrl: 'https://ethereal.email/login',
        user: account.user,
        pass: account.pass,
      },
    });
  });

  it('describe() reuses the account already created by send() instead of creating a second one', async () => {
    const sender = new EtherealEmailSender(makeConfig());

    await sender.send({ to: 'a@b.com', subject: 'Hi', text: 'hi' });
    const result = await sender.describe();

    expect(mockCreateTestAccount).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      provider: 'ethereal',
      ethereal: {
        loginUrl: 'https://ethereal.email/login',
        user: account.user,
        pass: account.pass,
      },
    });
  });

  it('retries account creation on the next send after a failure', async () => {
    mockCreateTestAccount.mockRejectedValueOnce(new Error('ethereal is down'));
    const sender = new EtherealEmailSender(makeConfig());

    await expect(
      sender.send({ to: 'a@b.com', subject: 'Hi', text: 'hi' }),
    ).rejects.toThrow('ethereal is down');

    mockCreateTestAccount.mockResolvedValueOnce(account);
    const result = await sender.send({
      to: 'a@b.com',
      subject: 'Hi',
      text: 'hi',
    });

    expect(mockCreateTestAccount).toHaveBeenCalledTimes(2);
    expect(result).toBe('https://ethereal.email/message/abc123');
  });
});
