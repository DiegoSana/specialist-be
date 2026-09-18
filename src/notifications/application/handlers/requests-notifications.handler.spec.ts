import { RequestStatus } from '@prisma/client';
import { RequestsNotificationsHandler } from './requests-notifications.handler';
import { RequestStatusChangedEvent } from '../../../requests/domain/events/request-status-changed.event';

describe('RequestsNotificationsHandler.onStatusChanged', () => {
  let handler: RequestsNotificationsHandler;
  let mockNotifications: any;

  beforeEach(() => {
    mockNotifications = { createForUser: jest.fn() };
    handler = new RequestsNotificationsHandler(
      { on: jest.fn() },
      mockNotifications,
      { getByIdOrFail: jest.fn() } as any,
    );
  });

  const buildEvent = (changedByUserId: string) =>
    new RequestStatusChangedEvent({
      requestId: 'req-1',
      requestTitle: 'Arreglar canilla',
      clientId: 'client-1',
      clientName: 'Ana',
      professionalId: null,
      professionalName: null,
      serviceProviderId: 'sp-1',
      providerUserId: 'provider-1',
      providerName: 'Beto',
      fromStatus: RequestStatus.ACCEPTED,
      toStatus: RequestStatus.IN_PROGRESS,
      changedByUserId,
    });

  const notifiedUserIds = () =>
    mockNotifications.createForUser.mock.calls.map((c: any[]) => c[0].userId);

  it('does not notify the client when the client made the change', async () => {
    await (handler as any).onStatusChanged(buildEvent('client-1'));

    expect(notifiedUserIds()).toEqual(['provider-1']);
  });

  it('does not notify the provider when the provider made the change', async () => {
    await (handler as any).onStatusChanged(buildEvent('provider-1'));

    expect(notifiedUserIds()).toEqual(['client-1']);
  });

  it('notifies both when a third party (e.g. an admin) made the change', async () => {
    await (handler as any).onStatusChanged(buildEvent('admin-1'));

    expect(notifiedUserIds()).toEqual(['client-1', 'provider-1']);
  });
});
