import { SupportConversationAttentionFlaggedHandler } from './support-conversation-attention-flagged.handler';
import { SupportConversationAttentionFlaggedEvent } from '../../../support/domain/events/support-conversation-attention-flagged.event';

describe('SupportConversationAttentionFlaggedHandler', () => {
  let handler: SupportConversationAttentionFlaggedHandler;
  let mockEventBus: any;
  let mockNotifications: any;
  let mockUserService: any;

  beforeEach(() => {
    mockEventBus = { on: jest.fn() };
    mockNotifications = { createForUser: jest.fn() };
    mockUserService = { findAdminUserIds: jest.fn() };

    handler = new SupportConversationAttentionFlaggedHandler(
      mockEventBus,
      mockNotifications,
      mockUserService,
    );
  });

  const buildEvent = () =>
    new SupportConversationAttentionFlaggedEvent({
      conversationId: 'conv-1',
      phoneNumber: '+5492944123456',
      userId: 'user-1',
    });

  it('subscribes to the event on module init', () => {
    handler.onModuleInit();

    expect(mockEventBus.on).toHaveBeenCalledWith(
      SupportConversationAttentionFlaggedEvent.EVENT_NAME,
      expect.any(Function),
    );
  });

  it('does not throw when the event bus does not support subscriptions', () => {
    const handlerWithoutBus = new SupportConversationAttentionFlaggedHandler(
      {} as any,
      mockNotifications,
      mockUserService,
    );

    expect(() => handlerWithoutBus.onModuleInit()).not.toThrow();
  });

  it('notifies every admin, in-app only, with a distinct idempotencyKey per admin', async () => {
    mockUserService.findAdminUserIds.mockResolvedValue(['admin-1', 'admin-2']);

    await (handler as any).onFlagged(buildEvent());

    expect(mockNotifications.createForUser).toHaveBeenCalledTimes(2);
    expect(mockNotifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        type: 'SUPPORT_CONVERSATION_NEEDS_ATTENTION',
        includeExternal: false,
        data: expect.objectContaining({ conversationId: 'conv-1' }),
        idempotencyKey: expect.stringContaining('admin-1'),
      }),
    );
    expect(mockNotifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-2',
        idempotencyKey: expect.stringContaining('admin-2'),
      }),
    );
  });

  it('does nothing (but does not throw) when there are no admin users', async () => {
    mockUserService.findAdminUserIds.mockResolvedValue([]);

    await expect(
      (handler as any).onFlagged(buildEvent()),
    ).resolves.not.toThrow();

    expect(mockNotifications.createForUser).not.toHaveBeenCalled();
  });

  it('never throws even if createForUser fails', async () => {
    mockUserService.findAdminUserIds.mockResolvedValue(['admin-1']);
    mockNotifications.createForUser.mockRejectedValue(new Error('db down'));

    await expect(
      (handler as any).onFlagged(buildEvent()),
    ).resolves.not.toThrow();
  });
});
