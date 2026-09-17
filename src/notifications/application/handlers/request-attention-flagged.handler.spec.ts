import { RequestAttentionReason } from '@prisma/client';
import { RequestAttentionFlaggedHandler } from './request-attention-flagged.handler';
import { RequestAttentionFlaggedEvent } from '../../../requests/domain/events/request-attention-flagged.event';

describe('RequestAttentionFlaggedHandler', () => {
  let handler: RequestAttentionFlaggedHandler;
  let mockEventBus: any;
  let mockNotifications: any;
  let mockUserService: any;

  beforeEach(() => {
    mockEventBus = { on: jest.fn() };
    mockNotifications = { createForUser: jest.fn() };
    mockUserService = { findAdminUserIds: jest.fn() };

    handler = new RequestAttentionFlaggedHandler(
      mockEventBus,
      mockNotifications,
      mockUserService,
    );
  });

  const buildEvent = () =>
    new RequestAttentionFlaggedEvent({
      attentionFlagId: 'flag-1',
      requestId: 'request-123',
      reason: RequestAttentionReason.AT_RISK,
      detail: 'no response',
    });

  it('notifies every admin with a distinct idempotencyKey per admin', async () => {
    mockUserService.findAdminUserIds.mockResolvedValue(['admin-1', 'admin-2']);

    await (handler as any).onFlagged(buildEvent());

    expect(mockNotifications.createForUser).toHaveBeenCalledTimes(2);
    expect(mockNotifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        type: 'REQUEST_ATTENTION_FLAGGED',
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
