import { RequestStatus } from '@prisma/client';
import { RequestPublishedAgainHandler } from './request-published-again.handler';
import { RequestStatusChangedEvent } from '../../../requests/domain/events/request-status-changed.event';

describe('RequestPublishedAgainHandler', () => {
  let handler: RequestPublishedAgainHandler;
  let mockEventBus: any;
  let mockReviewService: any;

  beforeEach(() => {
    mockEventBus = { on: jest.fn() };
    mockReviewService = {
      deleteAllForRequest: jest.fn(),
    };

    handler = new RequestPublishedAgainHandler(mockEventBus, mockReviewService);
  });

  const buildEvent = (toStatus: RequestStatus) =>
    new RequestStatusChangedEvent({
      requestId: 'request-123',
      requestTitle: 'Fix the sink',
      clientId: 'client-123',
      clientName: 'Cliente',
      professionalId: null,
      professionalName: null,
      serviceProviderId: null,
      providerUserId: null,
      providerType: null,
      providerName: null,
      fromStatus: RequestStatus.CONTACT_RELEASED,
      toStatus,
      changedByUserId: 'admin-user',
    });

  it('deletes all reviews for the request when it is republished (toStatus PUBLISHED)', async () => {
    mockReviewService.deleteAllForRequest.mockResolvedValue(undefined);

    await (handler as any).onStatusChanged(buildEvent(RequestStatus.PUBLISHED));

    expect(mockReviewService.deleteAllForRequest).toHaveBeenCalledWith(
      'request-123',
    );
  });

  it('does nothing when toStatus is not PUBLISHED', async () => {
    await (handler as any).onStatusChanged(buildEvent(RequestStatus.CLOSED));

    expect(mockReviewService.deleteAllForRequest).not.toHaveBeenCalled();
  });

  it('never throws even if the service call fails', async () => {
    mockReviewService.deleteAllForRequest.mockRejectedValue(
      new Error('db down'),
    );

    await expect(
      (handler as any).onStatusChanged(buildEvent(RequestStatus.PUBLISHED)),
    ).resolves.not.toThrow();
  });
});
