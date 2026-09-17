import {
  RequestStatus,
  ResponseIntent,
  InteractionDirection,
} from '@prisma/client';
import { RequestInteractionRespondedHandler } from './request-interaction-responded.handler';
import { RequestInteractionRespondedEvent } from '../../domain/events/request-interaction-responded.event';
import { createMockRequest } from '../../../__mocks__/test-utils';

describe('RequestInteractionRespondedHandler', () => {
  let handler: RequestInteractionRespondedHandler;
  let mockEventBus: any;
  let mockRequestService: any;
  let mockInteractionRepository: any;
  let mockInteractionService: any;
  let mockRequestInterestService: any;
  let mockTemplateService: any;
  let mockProfessionalService: any;
  let mockCompanyService: any;

  beforeEach(() => {
    mockEventBus = { on: jest.fn() };
    mockRequestService = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };
    mockInteractionRepository = { findById: jest.fn() };
    mockInteractionService = { createFollowUp: jest.fn() };
    mockRequestInterestService = {};
    mockTemplateService = {};
    mockProfessionalService = {
      findByServiceProviderId: jest.fn().mockResolvedValue(null),
    };
    mockCompanyService = {
      findByServiceProviderId: jest.fn().mockResolvedValue(null),
    };

    handler = new RequestInteractionRespondedHandler(
      mockEventBus,
      mockRequestService,
      mockInteractionRepository,
      mockInteractionService,
      mockRequestInterestService,
      mockTemplateService,
      mockProfessionalService,
      mockCompanyService,
    );
  });

  const buildEvent = (
    overrides: Partial<
      ConstructorParameters<typeof RequestInteractionRespondedEvent>[0]
    > = {},
  ) =>
    new RequestInteractionRespondedEvent({
      interactionId: 'interaction-1',
      requestId: 'request-123',
      responseContent: 'si',
      responseIntent: ResponseIntent.CONFIRMED,
      respondedAt: new Date(),
      confidence: 1,
      viability: null,
      optOut: false,
      escalate: false,
      ...overrides,
    });

  it('still maps CONFIRMED on a PENDING request to ACCEPTED (status machine unchanged by the richer payload)', async () => {
    const request = createMockRequest({
      id: 'request-123',
      status: RequestStatus.PENDING,
    });
    mockRequestService.findById.mockResolvedValue(request);
    mockInteractionRepository.findById.mockResolvedValue({
      direction: InteractionDirection.TO_PROVIDER,
      messageTemplate: 'follow_up_3_days',
      metadata: null,
    });

    await (handler as any).handleInteractionResponded(buildEvent());

    expect(mockRequestService.updateStatus).toHaveBeenCalledWith(
      'request-123',
      expect.anything(),
      { status: RequestStatus.ACCEPTED },
    );
  });

  it('does not throw when confidence/viability/optOut/escalate are present on the payload', async () => {
    const request = createMockRequest({
      id: 'request-123',
      status: RequestStatus.PENDING,
    });
    mockRequestService.findById.mockResolvedValue(request);
    mockInteractionRepository.findById.mockResolvedValue({
      direction: InteractionDirection.TO_PROVIDER,
      messageTemplate: 'follow_up_3_days',
      metadata: null,
    });

    await expect(
      (handler as any).handleInteractionResponded(
        buildEvent({
          confidence: 0.42,
          viability: 'ABANDONED',
          optOut: true,
          escalate: true,
        }),
      ),
    ).resolves.not.toThrow();
  });
});
