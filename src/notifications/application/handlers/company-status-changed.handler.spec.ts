import { CompanyStatusChangedHandler } from './company-status-changed.handler';
import { CompanyStatusChangedEvent } from '../../../profiles/domain/events/company-status-changed.event';
import { CompanyStatus } from '../../../profiles/domain/entities/company.entity';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';

describe('CompanyStatusChangedHandler', () => {
  let handler: CompanyStatusChangedHandler;
  let mockEventBus: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockEventBus = { on: jest.fn() };
    mockNotifications = { createForUser: jest.fn() };
    handler = new CompanyStatusChangedHandler(mockEventBus, mockNotifications);
  });

  const buildEvent = (newStatus: CompanyStatus) =>
    new CompanyStatusChangedEvent({
      companyId: 'company-1',
      userId: 'user-1',
      companyName: 'Remodelaciones Express',
      previousStatus: CompanyStatus.PENDING_VERIFICATION,
      newStatus,
    });

  it.each([
    [CompanyStatus.ACTIVE, 'COMPANY_VERIFIED'],
    [CompanyStatus.VERIFIED, 'COMPANY_VERIFIED'],
    [CompanyStatus.REJECTED, 'COMPANY_REJECTED'],
    [CompanyStatus.SUSPENDED, 'COMPANY_SUSPENDED'],
  ])('notifies the owner when status becomes %s', async (status, type) => {
    await (handler as any).onStatusChanged(buildEvent(status));

    expect(mockNotifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type,
        includeExternal: true,
        forceExternalChannel: NotificationChannel.EMAIL,
      }),
    );
  });

  it('stays silent for statuses the owner does not need to hear about', async () => {
    await (handler as any).onStatusChanged(buildEvent(CompanyStatus.INACTIVE));

    expect(mockNotifications.createForUser).not.toHaveBeenCalled();
  });

  it('never throws even if createForUser fails', async () => {
    mockNotifications.createForUser.mockRejectedValue(new Error('db down'));

    await expect(
      (handler as any).onStatusChanged(buildEvent(CompanyStatus.ACTIVE)),
    ).resolves.not.toThrow();
  });

  it('subscribes to the event on module init', () => {
    handler.onModuleInit();

    expect(mockEventBus.on).toHaveBeenCalledWith(
      CompanyStatusChangedEvent.EVENT_NAME,
      expect.any(Function),
    );
  });
});
