import { RequestAttentionReason } from '@prisma/client';
import { RequestAttentionService } from './request-attention.service';

describe('RequestAttentionService', () => {
  let service: RequestAttentionService;
  let mockAttentionFlagRepository: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockAttentionFlagRepository = {
      hasOpenByRequestAndReason: jest.fn(),
      add: jest.fn(),
    };
    mockEventBus = { publish: jest.fn() };

    service = new RequestAttentionService(
      mockAttentionFlagRepository,
      mockEventBus,
    );
  });

  it('creates a flag and publishes RequestAttentionFlaggedEvent when none is open', async () => {
    mockAttentionFlagRepository.hasOpenByRequestAndReason.mockResolvedValue(
      false,
    );
    mockAttentionFlagRepository.add.mockResolvedValue({
      id: 'flag-1',
      requestId: 'request-123',
      reason: RequestAttentionReason.AT_RISK,
      detail: null,
    });

    await service.flag(
      'request-123',
      RequestAttentionReason.AT_RISK,
      'no response',
    );

    expect(mockAttentionFlagRepository.add).toHaveBeenCalledWith({
      requestId: 'request-123',
      reason: RequestAttentionReason.AT_RISK,
      detail: 'no response',
    });
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          attentionFlagId: 'flag-1',
          requestId: 'request-123',
          reason: RequestAttentionReason.AT_RISK,
        }),
      }),
    );
  });

  it('is idempotent: does nothing when an open flag with the same reason already exists', async () => {
    mockAttentionFlagRepository.hasOpenByRequestAndReason.mockResolvedValue(
      true,
    );

    await service.flag('request-123', RequestAttentionReason.ESCALATED);

    expect(mockAttentionFlagRepository.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
