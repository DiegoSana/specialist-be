import { RequestStatus } from '@prisma/client';
import { AdminRequestReviewController } from './admin-request-review.controller';
import { createMockRequest } from '../../../__mocks__/test-utils';

describe('AdminRequestReviewController', () => {
  it('delegates to RequestService.resolveReview with the admin user id and note', async () => {
    const closed = createMockRequest({ status: RequestStatus.CLOSED });
    const requestService = {
      resolveReview: jest.fn().mockResolvedValue(closed),
    };
    const controller = new AdminRequestReviewController(requestService as any);

    const result = await controller.resolveReview('req-123', { note: 'ok' }, {
      id: 'admin-1',
    } as any);

    expect(requestService.resolveReview).toHaveBeenCalledWith(
      'req-123',
      'admin-1',
      'ok',
    );
    expect(result.status).toBe(RequestStatus.CLOSED);
  });
});
