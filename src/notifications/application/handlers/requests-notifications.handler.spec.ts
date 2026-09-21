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
      fromStatus: RequestStatus.CONTACT_RELEASED,
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

  it('notifies both with neutral copy when the system actor made the change', async () => {
    const event = new RequestStatusChangedEvent({
      ...buildEvent('system').payload,
      fromStatus: RequestStatus.CONTACT_RELEASED,
      toStatus: RequestStatus.ABANDONED,
      changedByUserId: 'system',
      changedByActorKind: 'SYSTEM',
    });

    await (handler as any).onStatusChanged(event);

    expect(notifiedUserIds()).toEqual(['client-1', 'provider-1']);
    const titles = mockNotifications.createForUser.mock.calls.map(
      (c: any[]) => c[0].title,
    );
    expect(titles).toEqual([
      '"Arreglar canilla" pasó a "Abandonado"',
      '"Arreglar canilla" pasó a "Abandonado"',
    ]);
  });

  it('notifies both with neutral copy when support closed a request under review', async () => {
    const event = new RequestStatusChangedEvent({
      ...buildEvent('support-1').payload,
      fromStatus: RequestStatus.UNDER_REVIEW,
      toStatus: RequestStatus.CLOSED,
      changedByUserId: 'support-1',
      changedByActorKind: 'SUPPORT',
    });

    await (handler as any).onStatusChanged(event);

    expect(notifiedUserIds()).toEqual(['client-1', 'provider-1']);
    const titles = mockNotifications.createForUser.mock.calls.map(
      (c: any[]) => c[0].title,
    );
    expect(titles).toEqual([
      '"Arreglar canilla" pasó a "Cerrado"',
      '"Arreglar canilla" pasó a "Cerrado"',
    ]);
  });
});
