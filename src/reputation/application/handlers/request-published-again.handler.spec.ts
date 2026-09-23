import { RequestStatus } from '@prisma/client';
import { RequestPublishedAgainHandler } from './request-published-again.handler';
import { RequestStatusChangedEvent } from '../../../requests/domain/events/request-status-changed.event';

describe('RequestPublishedAgainHandler', () => {
  let handler: RequestPublishedAgainHandler;
  let mockEventBus: any;
  let mockReviewRepository: any;

  beforeEach(() => {
    mockEventBus = { on: jest.fn() };
    mockReviewRepository = {
      findByRequestId: jest.fn(),
      delete: jest.fn(),
    };

    handler = new RequestPublishedAgainHandler(
      mockEventBus,
      mockReviewRepository,
    );
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

  it('deletes the existing review when the request is republished (toStatus PUBLISHED)', async () => {
    mockReviewRepository.findByRequestId.mockResolvedValue({ id: 'review-1' });

    await (handler as any).onStatusChanged(buildEvent(RequestStatus.PUBLISHED));

    expect(mockReviewRepository.findByRequestId).toHaveBeenCalledWith(
      'request-123',
    );
    expect(mockReviewRepository.delete).toHaveBeenCalledWith('review-1');
  });

  it('does nothing (but does not throw) when there is no existing review', async () => {
    mockReviewRepository.findByRequestId.mockResolvedValue(null);

    await expect(
      (handler as any).onStatusChanged(buildEvent(RequestStatus.PUBLISHED)),
    ).resolves.not.toThrow();

    expect(mockReviewRepository.delete).not.toHaveBeenCalled();
  });

  it('does nothing when toStatus is not PUBLISHED', async () => {
    await (handler as any).onStatusChanged(buildEvent(RequestStatus.CLOSED));

    expect(mockReviewRepository.findByRequestId).not.toHaveBeenCalled();
    expect(mockReviewRepository.delete).not.toHaveBeenCalled();
  });

  it('never throws even if the repository fails', async () => {
    mockReviewRepository.findByRequestId.mockRejectedValue(
      new Error('db down'),
    );

    await expect(
      (handler as any).onStatusChanged(buildEvent(RequestStatus.PUBLISHED)),
    ).resolves.not.toThrow();
  });
});
