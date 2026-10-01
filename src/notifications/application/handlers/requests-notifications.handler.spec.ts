import { RequestStatus, ProfessionalStatus } from '@prisma/client';
import { RequestsNotificationsHandler } from './requests-notifications.handler';
import { RequestStatusChangedEvent } from '../../../requests/domain/events/request-status-changed.event';
import { RequestCreatedEvent } from '../../../requests/domain/events/request-created.event';
import {
  createMockProfessional,
  createMockUser,
} from '../../../__mocks__/test-utils';

describe('RequestsNotificationsHandler.onStatusChanged', () => {
  let handler: RequestsNotificationsHandler;
  let mockNotifications: any;

  beforeEach(() => {
    mockNotifications = { createForUser: jest.fn() };
    handler = new RequestsNotificationsHandler(
      { on: jest.fn() },
      mockNotifications,
      { getByIdOrFail: jest.fn() } as any,
      { findById: jest.fn() } as any,
      { sendMessage: jest.fn() } as any,
      { getTemplate: jest.fn().mockResolvedValue('rendered message') } as any,
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

describe('RequestsNotificationsHandler.onRequestCreated', () => {
  let handler: RequestsNotificationsHandler;
  let mockNotifications: any;
  let mockProfessionalService: any;
  let mockUserService: any;
  let mockWhatsApp: any;
  let mockTemplateService: any;

  const buildEvent = (
    overrides: Partial<{
      isPublic: boolean;
      tradeId: string | null;
    }> = {},
  ) =>
    new RequestCreatedEvent({
      requestId: 'req-1',
      clientId: 'client-1',
      isPublic: true,
      professionalId: null,
      tradeId: 'trade-1',
      ...overrides,
    });

  beforeEach(() => {
    mockNotifications = { createForUser: jest.fn() };
    mockProfessionalService = { findByTradeId: jest.fn() };
    mockUserService = { findById: jest.fn() };
    mockWhatsApp = { sendMessage: jest.fn() };
    mockTemplateService = {
      getTemplate: jest.fn().mockResolvedValue('rendered message'),
    };

    handler = new RequestsNotificationsHandler(
      { on: jest.fn() },
      mockNotifications,
      mockProfessionalService,
      mockUserService,
      mockWhatsApp,
      mockTemplateService,
    );
  });

  it('does nothing when the request is not public', async () => {
    await (handler as any).onRequestCreated(buildEvent({ isPublic: false }));

    expect(mockProfessionalService.findByTradeId).not.toHaveBeenCalled();
    expect(mockNotifications.createForUser).not.toHaveBeenCalled();
  });

  it('does nothing when the request has no tradeId', async () => {
    await (handler as any).onRequestCreated(buildEvent({ tradeId: null }));

    expect(mockProfessionalService.findByTradeId).not.toHaveBeenCalled();
    expect(mockNotifications.createForUser).not.toHaveBeenCalled();
  });

  it('notifies and WhatsApp-messages opted-in, operable professionals matching the trade', async () => {
    const professional = createMockProfessional({
      id: 'prof-1',
      userId: 'user-1',
      status: ProfessionalStatus.VERIFIED,
      notifyOnNewMatchingRequest: true,
      trades: [
        {
          id: 'trade-1',
          name: 'Plomería',
          category: null,
          description: null,
          isPrimary: true,
        },
      ],
    });
    mockProfessionalService.findByTradeId.mockResolvedValue([professional]);
    mockUserService.findById.mockResolvedValue(
      createMockUser({ phone: '+5492944000000', phoneVerified: true }),
    );

    await (handler as any).onRequestCreated(buildEvent());

    expect(mockNotifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'REQUEST_MATCHING_TRADE_CREATED',
        includeExternal: false,
      }),
    );
    expect(mockWhatsApp.sendMessage).toHaveBeenCalledWith(
      '+5492944000000',
      'rendered message',
    );
  });

  it('skips professionals who did not opt in', async () => {
    const professional = createMockProfessional({
      notifyOnNewMatchingRequest: false,
      status: ProfessionalStatus.VERIFIED,
    });
    mockProfessionalService.findByTradeId.mockResolvedValue([professional]);

    await (handler as any).onRequestCreated(buildEvent());

    expect(mockNotifications.createForUser).not.toHaveBeenCalled();
    expect(mockWhatsApp.sendMessage).not.toHaveBeenCalled();
  });

  it('skips professionals who cannot operate even if opted in', async () => {
    const professional = createMockProfessional({
      notifyOnNewMatchingRequest: true,
      status: ProfessionalStatus.SUSPENDED,
    });
    mockProfessionalService.findByTradeId.mockResolvedValue([professional]);

    await (handler as any).onRequestCreated(buildEvent());

    expect(mockNotifications.createForUser).not.toHaveBeenCalled();
    expect(mockWhatsApp.sendMessage).not.toHaveBeenCalled();
  });

  it('does not send WhatsApp when the professional has no verified phone', async () => {
    const professional = createMockProfessional({
      userId: 'user-1',
      notifyOnNewMatchingRequest: true,
      status: ProfessionalStatus.VERIFIED,
    });
    mockProfessionalService.findByTradeId.mockResolvedValue([professional]);
    mockUserService.findById.mockResolvedValue(
      createMockUser({ phone: null, phoneVerified: false }),
    );

    await (handler as any).onRequestCreated(buildEvent());

    expect(mockNotifications.createForUser).toHaveBeenCalled();
    expect(mockWhatsApp.sendMessage).not.toHaveBeenCalled();
  });

  it('one professional failing does not block notifying the rest', async () => {
    const failing = createMockProfessional({
      id: 'prof-1',
      userId: 'user-1',
      notifyOnNewMatchingRequest: true,
      status: ProfessionalStatus.VERIFIED,
    });
    const ok = createMockProfessional({
      id: 'prof-2',
      userId: 'user-2',
      notifyOnNewMatchingRequest: true,
      status: ProfessionalStatus.VERIFIED,
    });
    mockProfessionalService.findByTradeId.mockResolvedValue([failing, ok]);
    mockNotifications.createForUser
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    mockUserService.findById.mockResolvedValue(
      createMockUser({ phone: '+5492944000000', phoneVerified: true }),
    );

    await (handler as any).onRequestCreated(buildEvent());

    expect(mockNotifications.createForUser).toHaveBeenCalledTimes(2);
    expect(mockWhatsApp.sendMessage).toHaveBeenCalledTimes(1);
  });
});
