import { PasswordResetRequestedHandler } from './password-reset-requested.handler';
import { PasswordResetRequestedEvent } from '../../../identity/domain/events/password-reset-requested.event';
import { PasswordResetOauthOnlyAttemptedEvent } from '../../../identity/domain/events/password-reset-oauth-only-attempted.event';

describe('PasswordResetRequestedHandler', () => {
  let handler: PasswordResetRequestedHandler;
  let mockEventBus: any;
  let mockEmailSender: any;

  beforeEach(() => {
    mockEventBus = { on: jest.fn() };
    mockEmailSender = { send: jest.fn().mockResolvedValue('message-id') };

    handler = new PasswordResetRequestedHandler(mockEventBus, mockEmailSender);
  });

  const buildRequestedEvent = () =>
    new PasswordResetRequestedEvent({
      userId: 'user-123',
      email: 'user@example.com',
      resetUrl: 'http://localhost:3000/es/reset-password?token=abc123',
    });

  const buildOauthOnlyEvent = (
    overrides: Partial<{ googleLinked: boolean; facebookLinked: boolean }> = {},
  ) =>
    new PasswordResetOauthOnlyAttemptedEvent({
      userId: 'user-123',
      email: 'user@example.com',
      googleLinked: overrides.googleLinked ?? true,
      facebookLinked: overrides.facebookLinked ?? false,
    });

  describe('onRequested (private, called through the event bus)', () => {
    it('sends the reset email directly through EMAIL_SENDER, with the link in the body', async () => {
      await (handler as any).onRequested(buildRequestedEvent());

      expect(mockEmailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.any(String),
          text: expect.stringContaining(
            'http://localhost:3000/es/reset-password?token=abc123',
          ),
          html: expect.stringContaining(
            'http://localhost:3000/es/reset-password?token=abc123',
          ),
        }),
      );
    });

    it('never throws even if send fails', async () => {
      mockEmailSender.send.mockRejectedValue(new Error('smtp down'));

      await expect(
        (handler as any).onRequested(buildRequestedEvent()),
      ).resolves.not.toThrow();
    });
  });

  describe('onOauthOnlyAttempted (private, called through the event bus)', () => {
    it('sends an explanatory email without a reset link', async () => {
      await (handler as any).onOauthOnlyAttempted(buildOauthOnlyEvent());

      expect(mockEmailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.any(String),
        }),
      );
      const call = mockEmailSender.send.mock.calls[0][0];
      expect(call.text).not.toContain('http');
      expect(call.html).not.toContain('href="http');
    });

    it('never throws even if send fails', async () => {
      mockEmailSender.send.mockRejectedValue(new Error('smtp down'));

      await expect(
        (handler as any).onOauthOnlyAttempted(buildOauthOnlyEvent()),
      ).resolves.not.toThrow();
    });
  });

  it('subscribes to both events on module init', () => {
    handler.onModuleInit();

    expect(mockEventBus.on).toHaveBeenCalledWith(
      PasswordResetRequestedEvent.EVENT_NAME,
      expect.any(Function),
    );
    expect(mockEventBus.on).toHaveBeenCalledWith(
      PasswordResetOauthOnlyAttemptedEvent.EVENT_NAME,
      expect.any(Function),
    );
  });

  it('does not throw when the event bus does not support subscriptions', () => {
    const handlerWithoutBus = new PasswordResetRequestedHandler(
      {},
      mockEmailSender,
    );

    expect(() => handlerWithoutBus.onModuleInit()).not.toThrow();
  });
});
