import { UserWhatsAppOptedOutHandler } from './user-whatsapp-opted-out.handler';
import { UserWhatsAppOptedOutEvent } from '../../../identity/domain/events/user-whatsapp-opted-out.event';
import { UserWhatsAppReactivatedEvent } from '../../../identity/domain/events/user-whatsapp-reactivated.event';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';

describe('UserWhatsAppOptedOutHandler', () => {
  let handler: UserWhatsAppOptedOutHandler;
  let mockEventBus: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockEventBus = { on: jest.fn() };
    mockNotifications = { createForUser: jest.fn() };

    handler = new UserWhatsAppOptedOutHandler(mockEventBus, mockNotifications);
  });

  const buildEvent = () =>
    new UserWhatsAppOptedOutEvent({ userId: 'user-123' });

  const buildReactivatedEvent = () =>
    new UserWhatsAppReactivatedEvent({ userId: 'user-123' });

  it('creates a notification with EMAIL forced as the external channel', async () => {
    await (handler as any).onOptedOut(buildEvent());

    expect(mockNotifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        type: 'WHATSAPP_OPTED_OUT',
        includeExternal: true,
        requireExternal: true,
        forceExternalChannel: NotificationChannel.EMAIL,
      }),
    );
  });

  it('never throws even if createForUser fails', async () => {
    mockNotifications.createForUser.mockRejectedValue(new Error('db down'));

    await expect(
      (handler as any).onOptedOut(buildEvent()),
    ).resolves.not.toThrow();
  });

  it('subscribes to both events on module init', () => {
    handler.onModuleInit();

    expect(mockEventBus.on).toHaveBeenCalledWith(
      UserWhatsAppOptedOutEvent.EVENT_NAME,
      expect.any(Function),
    );
    expect(mockEventBus.on).toHaveBeenCalledWith(
      UserWhatsAppReactivatedEvent.EVENT_NAME,
      expect.any(Function),
    );
  });

  it('does not throw when the event bus does not support subscriptions', () => {
    const handlerWithoutBus = new UserWhatsAppOptedOutHandler(
      {},
      mockNotifications,
    );

    expect(() => handlerWithoutBus.onModuleInit()).not.toThrow();
  });

  it('creates a reactivation notification with EMAIL forced as the external channel', async () => {
    await (handler as any).onReactivated(buildReactivatedEvent());

    expect(mockNotifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        type: 'WHATSAPP_REACTIVATED',
        includeExternal: true,
        requireExternal: true,
        forceExternalChannel: NotificationChannel.EMAIL,
      }),
    );
  });

  it('never throws even if createForUser fails for reactivation', async () => {
    mockNotifications.createForUser.mockRejectedValue(new Error('db down'));

    await expect(
      (handler as any).onReactivated(buildReactivatedEvent()),
    ).resolves.not.toThrow();
  });
});
