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
  let mockAttentionService: any;
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
    mockAttentionService = { flag: jest.fn() };
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
      mockAttentionService,
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

  const interactionFor = (
    messageTemplate: string,
    direction: InteractionDirection = InteractionDirection.TO_PROVIDER,
  ) =>
    mockInteractionRepository.findById.mockResolvedValue({
      direction,
      messageTemplate,
      metadata: null,
    });

  const run = async (
    status: RequestStatus,
    template: string,
    direction: InteractionDirection,
    intent: ResponseIntent,
    text = 'respuesta',
  ) => {
    mockRequestService.findById.mockResolvedValue(
      createMockRequest({ id: 'request-123', status }),
    );
    interactionFor(template, direction);
    await (handler as any).handleInteractionResponded(
      buildEvent({ responseIntent: intent, responseContent: text }),
    );
  };

  describe('reply -> status mapping (spec P1/P2/P3)', () => {
    it.each([
      [ResponseIntent.CONFIRMED, RequestStatus.IN_PROGRESS],
      [ResponseIntent.CANCELLED, RequestStatus.NOT_COMPLETED],
    ])(
      'question_agreement: %s moves CONTACT_RELEASED to %s',
      async (intent, expected) => {
        await run(
          RequestStatus.CONTACT_RELEASED,
          'question_agreement',
          InteractionDirection.TO_CLIENT,
          intent,
          'no pudimos',
        );
        expect(mockRequestService.updateStatus).toHaveBeenCalledWith(
          'request-123',
          expect.anything(),
          {
            status: expected,
            statusReason:
              expected === RequestStatus.NOT_COMPLETED
                ? 'no pudimos'
                : undefined,
          },
        );
      },
    );

    it('question_progress: COMPLETED moves IN_PROGRESS to FINISHED', async () => {
      await run(
        RequestStatus.IN_PROGRESS,
        'question_progress',
        InteractionDirection.TO_PROVIDER,
        ResponseIntent.COMPLETED,
      );
      expect(mockRequestService.updateStatus).toHaveBeenCalledWith(
        'request-123',
        expect.anything(),
        { status: RequestStatus.FINISHED, statusReason: undefined },
      );
    });

    it('question_progress: an explicit stop moves IN_PROGRESS to INTERRUPTED and stores the reason', async () => {
      await run(
        RequestStatus.IN_PROGRESS,
        'question_progress',
        InteractionDirection.TO_PROVIDER,
        ResponseIntent.CANCELLED,
        'tuve que dejarlo, se mudó',
      );
      expect(mockRequestService.updateStatus).toHaveBeenCalledWith(
        'request-123',
        expect.anything(),
        {
          status: RequestStatus.INTERRUPTED,
          statusReason: 'tuve que dejarlo, se mudó',
        },
      );
    });

    it.each([
      ['bare "no"', ResponseIntent.CANCELLED, 'No'],
      ['still going', ResponseIntent.STARTED, 'sigue en curso'],
      ['confirmation', ResponseIntent.CONFIRMED, 'si'],
      ['unclear', ResponseIntent.UNKNOWN, 'mmm'],
    ])(
      'question_progress: %s does not change IN_PROGRESS',
      async (_label, intent, text) => {
        await run(
          RequestStatus.IN_PROGRESS,
          'question_progress',
          InteractionDirection.TO_PROVIDER,
          intent,
          text,
        );
        expect(mockRequestService.updateStatus).not.toHaveBeenCalled();
      },
    );

    it.each([
      [ResponseIntent.CONFIRMED, RequestStatus.CLOSED],
      [ResponseIntent.CANCELLED, RequestStatus.UNDER_REVIEW],
    ])(
      'question_satisfaction: %s moves FINISHED to %s',
      async (intent, expected) => {
        await run(
          RequestStatus.FINISHED,
          'question_satisfaction',
          InteractionDirection.TO_CLIENT,
          intent,
        );
        expect(mockRequestService.updateStatus).toHaveBeenCalledWith(
          'request-123',
          expect.anything(),
          { status: expected, statusReason: undefined },
        );
      },
    );

    it('unclear replies never change the state', async () => {
      await run(
        RequestStatus.FINISHED,
        'question_satisfaction',
        InteractionDirection.TO_CLIENT,
        ResponseIntent.UNKNOWN,
      );
      expect(mockRequestService.updateStatus).not.toHaveBeenCalled();
    });

    it('replies to notices (actions live in the app) never change the state', async () => {
      await run(
        RequestStatus.SENT,
        'notice_request_sent',
        InteractionDirection.TO_PROVIDER,
        ResponseIntent.CONFIRMED,
      );
      expect(mockRequestService.updateStatus).not.toHaveBeenCalled();
    });

    it('ignores a reply to a question that no longer matches the current status', async () => {
      await run(
        RequestStatus.CLOSED,
        'question_satisfaction',
        InteractionDirection.TO_CLIENT,
        ResponseIntent.CANCELLED,
      );
      expect(mockRequestService.updateStatus).not.toHaveBeenCalled();
    });
  });

  it('does not throw when confidence/viability/optOut/escalate are present on the payload', async () => {
    const request = createMockRequest({
      id: 'request-123',
      status: RequestStatus.SENT,
    });
    mockRequestService.findById.mockResolvedValue(request);
    mockInteractionRepository.findById.mockResolvedValue({
      direction: InteractionDirection.TO_PROVIDER,
      messageTemplate: 'notice_request_sent',
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

  it('flags for attention instead of silently dropping a status change the actor is not authorized to make', async () => {
    const request = createMockRequest({
      id: 'request-123',
      status: RequestStatus.FINISHED,
    });
    mockRequestService.findById.mockResolvedValue(request);
    mockInteractionRepository.findById.mockResolvedValue({
      direction: InteractionDirection.TO_CLIENT,
      messageTemplate: 'question_satisfaction',
      metadata: null,
    });
    mockRequestService.updateStatus.mockRejectedValue(
      new Error('You do not have permission to change this request status'),
    );

    await (handler as any).handleInteractionResponded(
      buildEvent({ responseIntent: ResponseIntent.CANCELLED }),
    );

    expect(mockAttentionService.flag).toHaveBeenCalledWith(
      'request-123',
      'ESCALATED',
      expect.stringContaining('UNDER_REVIEW'),
    );
    expect(mockInteractionService.createFollowUp).not.toHaveBeenCalled();
  });

  it('flags for attention instead of attempting a doomed CONTACT_RELEASED transition when a client reply to the assign-by-number follow-up does not parse', async () => {
    const request = createMockRequest({
      id: 'request-123',
      status: RequestStatus.PUBLISHED,
    });
    mockRequestService.findById.mockResolvedValue(request);
    mockInteractionRepository.findById.mockResolvedValue({
      direction: InteractionDirection.TO_CLIENT,
      messageTemplate: 'notice_interests_published',
      metadata: { interestedProviderIds: ['sp-1'] },
    });

    await (handler as any).handleInteractionResponded(
      buildEvent({ responseContent: 'no entiendo bien, quien es el mejor?' }),
    );

    expect(mockAttentionService.flag).toHaveBeenCalledWith(
      'request-123',
      'ESCALATED',
      expect.stringContaining('no entiendo bien'),
    );
    expect(mockRequestService.updateStatus).not.toHaveBeenCalled();
  });
});
