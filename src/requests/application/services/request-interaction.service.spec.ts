import {
  InteractionDirection,
  InteractionStatus,
  InteractionType,
  RequestStatus,
  ResponseIntent,
} from '@prisma/client';
import { RequestInteractionService } from './request-interaction.service';
import { RequestInteractionEntity } from '../../domain/entities/request-interaction.entity';
import { createMockRequest } from '../../../__mocks__/test-utils';

const createMockInteraction = (
  overrides: Partial<{
    id: string;
    requestId: string;
    status: InteractionStatus;
    direction: InteractionDirection;
    messageTemplate: string;
    messageContent: string;
    responseContent: string | null;
    twilioMessageSid: string | null;
    createdAt: Date;
  }> = {},
): RequestInteractionEntity => {
  return new RequestInteractionEntity(
    overrides.id ?? 'interaction-123',
    overrides.requestId ?? 'request-123',
    InteractionType.FOLLOW_UP,
    overrides.status ?? InteractionStatus.DELIVERED,
    overrides.direction ?? InteractionDirection.TO_PROVIDER,
    'WHATSAPP',
    overrides.messageTemplate ?? 'follow_up_3_days',
    overrides.messageContent ?? 'Hola! ¿Ya empezaste?',
    overrides.responseContent ?? null,
    null,
    new Date(),
    new Date(),
    new Date(),
    null,
    overrides.twilioMessageSid ?? 'SM123',
    null,
    null,
    overrides.createdAt ?? new Date(),
    new Date(),
  );
};

describe('RequestInteractionService', () => {
  describe('processInboundMessage', () => {
    let service: RequestInteractionService;
    let mockInteractionRepository: any;
    let mockRequestRepository: any;
    let mockWhatsAppMessaging: any;
    let mockUserService: any;
    let mockProfessionalService: any;
    let mockCompanyService: any;
    let mockDetectIntentUseCase: any;
    let mockIntentDetectionPort: any;
    let mockTemplateService: any;
    let mockEventBus: any;
    let mockConfig: any;

    beforeEach(() => {
      mockInteractionRepository = {
        findByTwilioMessageSid: jest.fn(),
        findMostRecentByPhone: jest.fn(),
        findByRequestId: jest.fn().mockResolvedValue([]),
        save: jest.fn((i) => Promise.resolve(i)),
      };
      mockRequestRepository = {
        findById: jest.fn(),
      };
      mockWhatsAppMessaging = {};
      mockUserService = {};
      mockProfessionalService = {};
      mockCompanyService = {};
      mockDetectIntentUseCase = { detectIntent: jest.fn() };
      mockIntentDetectionPort = { detectIntent: jest.fn() };
      mockTemplateService = { getTemplate: jest.fn() };
      mockEventBus = { publish: jest.fn() };
      mockConfig = {
        get: jest.fn((_key: string, def?: unknown) => def),
      };

      service = new RequestInteractionService(
        mockInteractionRepository,
        mockRequestRepository,
        mockWhatsAppMessaging,
        mockUserService,
        mockProfessionalService,
        mockCompanyService,
        mockDetectIntentUseCase,
        mockIntentDetectionPort,
        mockTemplateService,
        mockEventBus,
        mockConfig,
      );
    });

    it('classifies via IntentDetectionPort with request status + triggering template + history, and publishes the responded event', async () => {
      const interaction = createMockInteraction({
        requestId: 'request-123',
        messageTemplate: 'follow_up_3_days',
      });
      const request = createMockRequest({
        id: 'request-123',
        status: RequestStatus.ACCEPTED,
      });
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
        interaction,
      );
      mockRequestRepository.findById.mockResolvedValue(request);
      mockIntentDetectionPort.detectIntent.mockResolvedValue({
        statusIntent: ResponseIntent.STARTED,
        confidence: 1,
        viability: null,
        optOut: false,
        escalate: false,
      });

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'ya empecé',
        messageId: 'SM123',
      });

      expect(mockIntentDetectionPort.detectIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          messageText: 'ya empecé',
          currentStatus: RequestStatus.ACCEPTED,
          triggeringTemplate: 'follow_up_3_days',
          conversationHistory: [],
        }),
      );
      expect(mockInteractionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InteractionStatus.RESPONDED,
          responseIntent: ResponseIntent.STARTED,
        }),
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            responseIntent: ResponseIntent.STARTED,
          }),
        }),
      );
    });

    it('builds conversation history oldest-first, capped to the last 6 messages', async () => {
      const interaction = createMockInteraction({ requestId: 'request-123' });
      const request = createMockRequest({
        id: 'request-123',
        status: RequestStatus.ACCEPTED,
      });
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
        interaction,
      );
      mockRequestRepository.findById.mockResolvedValue(request);
      mockIntentDetectionPort.detectIntent.mockResolvedValue({
        statusIntent: ResponseIntent.UNKNOWN,
        confidence: 1,
        viability: null,
        optOut: false,
        escalate: false,
      });

      // Repository returns newest-first, as the real implementation does.
      const history = Array.from({ length: 8 }, (_, idx) =>
        createMockInteraction({
          id: `history-${idx}`,
          messageContent: `msg-${idx}`,
          createdAt: new Date(2026, 0, 8 - idx),
        }),
      );
      mockInteractionRepository.findByRequestId.mockResolvedValue(history);

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'hola',
        messageId: 'SM123',
      });

      const call = mockIntentDetectionPort.detectIntent.mock.calls[0][0];
      expect(call.conversationHistory).toHaveLength(6);
      // Only the 6 most recent messages, oldest of that window first, newest last
      expect(call.conversationHistory[0].content).toBe('msg-5');
      expect(call.conversationHistory[5].content).toBe('msg-0');
    });

    it('falls back to keyword matching when the classifier port rejects (covers both errors and the Promise.race timeout path)', async () => {
      const interaction = createMockInteraction({ requestId: 'request-123' });
      const request = createMockRequest({
        id: 'request-123',
        status: RequestStatus.ACCEPTED,
      });
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
        interaction,
      );
      mockRequestRepository.findById.mockResolvedValue(request);
      mockIntentDetectionPort.detectIntent.mockRejectedValue(
        new Error('LLM unavailable'),
      );
      mockDetectIntentUseCase.detectIntent.mockReturnValue(
        ResponseIntent.STARTED,
      );

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'ya empecé',
        messageId: 'SM123',
      });

      expect(mockDetectIntentUseCase.detectIntent).toHaveBeenCalledWith(
        'ya empecé',
      );
      expect(mockInteractionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          responseIntent: ResponseIntent.STARTED,
        }),
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            responseIntent: ResponseIntent.STARTED,
            viability: null,
            optOut: false,
            escalate: false,
          }),
        }),
      );
    });

    it('downgrades statusIntent to UNKNOWN when confidence is below the configured threshold, but keeps the raw values in metadata', async () => {
      const interaction = createMockInteraction({ requestId: 'request-123' });
      const request = createMockRequest({
        id: 'request-123',
        status: RequestStatus.ACCEPTED,
      });
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
        interaction,
      );
      mockRequestRepository.findById.mockResolvedValue(request);
      mockConfig.get.mockImplementation((key: string, def?: unknown) =>
        key === 'INTENT_CLASSIFIER_CONFIDENCE_THRESHOLD' ? 0.6 : def,
      );
      mockIntentDetectionPort.detectIntent.mockResolvedValue({
        statusIntent: ResponseIntent.CANCELLED,
        confidence: 0.3,
        viability: 'AT_RISK',
        optOut: false,
        escalate: false,
      });

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'mmm no se',
        messageId: 'SM123',
      });

      expect(mockInteractionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          responseIntent: ResponseIntent.UNKNOWN,
          metadata: expect.objectContaining({
            rawClassifierIntent: ResponseIntent.CANCELLED,
            classifierConfidence: 0.3,
            viability: 'AT_RISK',
          }),
        }),
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            responseIntent: ResponseIntent.UNKNOWN,
          }),
        }),
      );
    });

    it('returns without classifying or saving when the parent request is not found', async () => {
      const interaction = createMockInteraction({
        requestId: 'missing-request',
      });
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
        interaction,
      );
      mockRequestRepository.findById.mockResolvedValue(null);

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'hola',
        messageId: 'SM123',
      });

      expect(mockIntentDetectionPort.detectIntent).not.toHaveBeenCalled();
      expect(mockInteractionRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
