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
    let mockAttentionService: any;
    let mockSupportConversationService: any;

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
      mockUserService = { setWhatsAppOptedOut: jest.fn() };
      mockProfessionalService = { findByServiceProviderId: jest.fn() };
      mockCompanyService = { findByServiceProviderId: jest.fn() };
      mockDetectIntentUseCase = { detectIntent: jest.fn() };
      mockIntentDetectionPort = { detectIntent: jest.fn() };
      mockTemplateService = { getTemplate: jest.fn() };
      mockEventBus = { publish: jest.fn() };
      mockConfig = {
        get: jest.fn((_key: string, def?: unknown) => def),
      };
      mockAttentionService = { flag: jest.fn() };
      mockSupportConversationService = {
        receiveInboundMessage: jest.fn(),
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
        mockAttentionService,
        mockSupportConversationService,
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

    it('records a WhatsApp opt-out for the client when the classifier detects one on a TO_CLIENT interaction', async () => {
      const interaction = createMockInteraction({
        requestId: 'request-123',
        direction: InteractionDirection.TO_CLIENT,
      });
      const request = createMockRequest({
        id: 'request-123',
        clientId: 'client-user-1',
        status: RequestStatus.DONE,
      });
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
        interaction,
      );
      mockRequestRepository.findById.mockResolvedValue(request);
      mockIntentDetectionPort.detectIntent.mockResolvedValue({
        statusIntent: ResponseIntent.UNKNOWN,
        confidence: 1,
        viability: null,
        optOut: true,
        escalate: false,
      });

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'dejen de escribirme',
        messageId: 'SM123',
      });

      expect(mockUserService.setWhatsAppOptedOut).toHaveBeenCalledWith(
        'client-user-1',
        true,
      );
    });

    it('records a WhatsApp opt-out for the assigned provider when the classifier detects one on a TO_PROVIDER interaction', async () => {
      const interaction = createMockInteraction({
        requestId: 'request-123',
        direction: InteractionDirection.TO_PROVIDER,
      });
      const request = createMockRequest({
        id: 'request-123',
        providerId: 'service-provider-1',
        status: RequestStatus.ACCEPTED,
      });
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
        interaction,
      );
      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue({
        userId: 'provider-user-1',
      });
      mockIntentDetectionPort.detectIntent.mockResolvedValue({
        statusIntent: ResponseIntent.UNKNOWN,
        confidence: 1,
        viability: null,
        optOut: true,
        escalate: false,
      });

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'BAJA',
        messageId: 'SM123',
      });

      expect(mockUserService.setWhatsAppOptedOut).toHaveBeenCalledWith(
        'provider-user-1',
        true,
      );
    });

    it('does not call setWhatsAppOptedOut when optOut is false', async () => {
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
        statusIntent: ResponseIntent.CONFIRMED,
        confidence: 1,
        viability: null,
        optOut: false,
        escalate: false,
      });

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'si',
        messageId: 'SM123',
      });

      expect(mockUserService.setWhatsAppOptedOut).not.toHaveBeenCalled();
    });

    it('still marks the interaction as responded even if recording the opt-out fails', async () => {
      const interaction = createMockInteraction({
        requestId: 'request-123',
        direction: InteractionDirection.TO_CLIENT,
      });
      const request = createMockRequest({
        id: 'request-123',
        clientId: 'client-user-1',
        status: RequestStatus.DONE,
      });
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
        interaction,
      );
      mockRequestRepository.findById.mockResolvedValue(request);
      mockUserService.setWhatsAppOptedOut.mockRejectedValue(
        new Error('db down'),
      );
      mockIntentDetectionPort.detectIntent.mockResolvedValue({
        statusIntent: ResponseIntent.UNKNOWN,
        confidence: 1,
        viability: null,
        optOut: true,
        escalate: false,
      });

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'dejen de escribirme',
        messageId: 'SM123',
      });

      expect(mockInteractionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InteractionStatus.RESPONDED }),
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

    it('matches via strategy 2 (findMostRecentByPhone) when no interaction has this twilioMessageSid', async () => {
      const interaction = createMockInteraction({
        requestId: 'request-123',
        twilioMessageSid: 'SM_OUTBOUND',
      });
      const request = createMockRequest({
        id: 'request-123',
        status: RequestStatus.ACCEPTED,
      });
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockInteractionRepository.findMostRecentByPhone.mockResolvedValue(
        interaction,
      );
      mockRequestRepository.findById.mockResolvedValue(request);
      mockIntentDetectionPort.detectIntent.mockResolvedValue({
        statusIntent: ResponseIntent.CONFIRMED,
        confidence: 1,
        viability: null,
        optOut: false,
        escalate: false,
      });

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'si dale',
        messageId: 'SM_INBOUND',
      });

      expect(
        mockInteractionRepository.findMostRecentByPhone,
      ).toHaveBeenCalledWith('+5492944123456', expect.any(Date));
      expect(mockInteractionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InteractionStatus.RESPONDED }),
      );
    });

    it('computes the findMostRecentByPhone cutoff from WHATSAPP_REPLY_MATCH_WINDOW_DAYS (default 14 days)', async () => {
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockInteractionRepository.findMostRecentByPhone.mockResolvedValue(null);
      mockConfig.get.mockImplementation((key: string, def?: unknown) =>
        key === 'WHATSAPP_REPLY_MATCH_WINDOW_DAYS' ? 14 : def,
      );

      const before = Date.now();
      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'hola',
        messageId: 'SM123',
      });
      const after = Date.now();

      const cutoff: Date =
        mockInteractionRepository.findMostRecentByPhone.mock.calls[0][1];
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(
        fourteenDaysMs - 5,
      );
      expect(after - cutoff.getTime()).toBeLessThanOrEqual(fourteenDaysMs + 5);
    });

    it('when nothing matches and SUPPORT_CONVERSATIONS_ENABLED is unset (default false), only logs - does not fork to support', async () => {
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockInteractionRepository.findMostRecentByPhone.mockResolvedValue(null);

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'hola, alguien?',
        messageId: 'SM123',
      });

      expect(
        mockSupportConversationService.receiveInboundMessage,
      ).not.toHaveBeenCalled();
    });

    it('when nothing matches and SUPPORT_CONVERSATIONS_ENABLED=true, forks the message to SupportConversationService', async () => {
      mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockInteractionRepository.findMostRecentByPhone.mockResolvedValue(null);
      mockConfig.get.mockImplementation((key: string, def?: unknown) =>
        key === 'SUPPORT_CONVERSATIONS_ENABLED' ? 'true' : def,
      );

      await service.processInboundMessage({
        from: 'whatsapp:+5492944123456',
        body: 'hola, alguien?',
        messageId: 'SM123',
      });

      expect(
        mockSupportConversationService.receiveInboundMessage,
      ).toHaveBeenCalledWith({
        phoneNumber: '+5492944123456',
        body: 'hola, alguien?',
        twilioMessageSid: 'SM123',
      });
    });
  });

  describe('processInboundMessage refactor - extracted methods', () => {
    let service: RequestInteractionService;
    let mockInteractionRepository: any;
    let mockConfig: any;
    let mockAttentionService: any;
    let mockUserService: any;
    let mockSupportConversationService: any;

    beforeEach(() => {
      mockInteractionRepository = {
        findByTwilioMessageSid: jest.fn(),
        findMostRecentByPhone: jest.fn(),
        save: jest.fn(),
      };
      mockConfig = { get: jest.fn((_k: string, def?: unknown) => def) };
      mockAttentionService = { flag: jest.fn() };
      mockUserService = { setWhatsAppOptedOut: jest.fn() };
      mockSupportConversationService = { receiveInboundMessage: jest.fn() };

      service = new RequestInteractionService(
        mockInteractionRepository,
        {} as any,
        {} as any,
        mockUserService,
        {} as any,
        {} as any,
        { detectIntent: jest.fn() } as any,
        {
          detectIntent: jest.fn().mockRejectedValue(new Error('unused')),
        } as any,
        {} as any,
        { publish: jest.fn() } as any,
        mockConfig,
        mockAttentionService,
        mockSupportConversationService,
      );
    });

    describe('matchInboundMessage', () => {
      it('returns the interaction found by twilioMessageSid without consulting findMostRecentByPhone', async () => {
        const interaction = createMockInteraction();
        mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
          interaction,
        );

        const result = await (service as any).matchInboundMessage(
          '+5492944123456',
          'SM123',
          new Date(),
        );

        expect(result).toBe(interaction);
        expect(
          mockInteractionRepository.findMostRecentByPhone,
        ).not.toHaveBeenCalled();
      });

      it('falls back to findMostRecentByPhone with the given cutoff when no twilioMessageSid match exists', async () => {
        const interaction = createMockInteraction();
        mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
          null,
        );
        mockInteractionRepository.findMostRecentByPhone.mockResolvedValue(
          interaction,
        );
        const cutoff = new Date('2026-09-01T00:00:00.000Z');

        const result = await (service as any).matchInboundMessage(
          '+5492944123456',
          'SM123',
          cutoff,
        );

        expect(result).toBe(interaction);
        expect(
          mockInteractionRepository.findMostRecentByPhone,
        ).toHaveBeenCalledWith('+5492944123456', cutoff);
      });

      it('returns null when neither strategy matches', async () => {
        mockInteractionRepository.findByTwilioMessageSid.mockResolvedValue(
          null,
        );
        mockInteractionRepository.findMostRecentByPhone.mockResolvedValue(null);

        const result = await (service as any).matchInboundMessage(
          '+5492944123456',
          'SM123',
          new Date(),
        );

        expect(result).toBeNull();
      });
    });

    describe('classifyInboundReply', () => {
      it('downgrades to UNKNOWN below the confidence threshold and keeps the raw classification', async () => {
        const intentPort = {
          detectIntent: jest.fn().mockResolvedValue({
            statusIntent: ResponseIntent.CANCELLED,
            confidence: 0.2,
            viability: 'AT_RISK',
            optOut: false,
            escalate: false,
          }),
        };
        (service as any).intentDetectionPort = intentPort;
        mockConfig.get.mockImplementation((key: string, def?: unknown) =>
          key === 'INTENT_CLASSIFIER_CONFIDENCE_THRESHOLD' ? 0.6 : def,
        );

        const result = await (service as any).classifyInboundReply({
          messageText: 'mmm no se',
          currentStatus: RequestStatus.ACCEPTED,
          triggeringTemplate: null,
          conversationHistory: [],
        });

        expect(result.intent).toBe(ResponseIntent.UNKNOWN);
        expect(result.classification.statusIntent).toBe(
          ResponseIntent.CANCELLED,
        );
      });

      it('forces optOut=true when the message contains an explicit opt-out keyword, even if the classifier said false', async () => {
        const intentPort = {
          detectIntent: jest.fn().mockResolvedValue({
            statusIntent: ResponseIntent.UNKNOWN,
            confidence: 1,
            viability: null,
            optOut: false,
            escalate: false,
          }),
        };
        (service as any).intentDetectionPort = intentPort;

        const result = await (service as any).classifyInboundReply({
          messageText: 'STOP',
          currentStatus: RequestStatus.ACCEPTED,
          triggeringTemplate: null,
          conversationHistory: [],
        });

        expect(result.classification.optOut).toBe(true);
      });
    });

    describe('applyClassificationSideEffects', () => {
      it('records opt-out when classification.optOut is true', async () => {
        const interaction = createMockInteraction({
          direction: InteractionDirection.TO_CLIENT,
        });
        const request = {
          id: 'request-123',
          clientId: 'client-1',
          providerId: null,
        };

        await (service as any).applyClassificationSideEffects(
          interaction,
          request,
          { optOut: true, escalate: false, viability: null },
          'dejen de escribirme',
        );

        expect(mockUserService.setWhatsAppOptedOut).toHaveBeenCalledWith(
          'client-1',
          true,
        );
      });

      it('flags ESCALATED when classification.escalate is true', async () => {
        const interaction = createMockInteraction();
        const request = {
          id: 'request-123',
          clientId: 'client-1',
          providerId: null,
        };

        await (service as any).applyClassificationSideEffects(
          interaction,
          request,
          { optOut: false, escalate: true, viability: null },
          'quiero hablar con un humano YA',
        );

        expect(mockAttentionService.flag).toHaveBeenCalledWith(
          'request-123',
          'ESCALATED',
          'quiero hablar con un humano YA',
        );
      });

      it('flags ABANDONED when classification.viability is ABANDONED (and escalate is false)', async () => {
        const interaction = createMockInteraction();
        const request = {
          id: 'request-123',
          clientId: 'client-1',
          providerId: null,
        };

        await (service as any).applyClassificationSideEffects(
          interaction,
          request,
          { optOut: false, escalate: false, viability: 'ABANDONED' },
          'ya no me interesa',
        );

        expect(mockAttentionService.flag).toHaveBeenCalledWith(
          'request-123',
          'ABANDONED',
          'ya no me interesa',
        );
      });

      it('does nothing when optOut/escalate are false and viability is not ABANDONED', async () => {
        const interaction = createMockInteraction();
        const request = {
          id: 'request-123',
          clientId: 'client-1',
          providerId: null,
        };

        await (service as any).applyClassificationSideEffects(
          interaction,
          request,
          { optOut: false, escalate: false, viability: null },
          'todo bien',
        );

        expect(mockUserService.setWhatsAppOptedOut).not.toHaveBeenCalled();
        expect(mockAttentionService.flag).not.toHaveBeenCalled();
      });
    });

    describe('buildRespondedInteraction', () => {
      it('merges classification and inbound message sid into metadata, and marks the interaction RESPONDED with the given intent', () => {
        const interaction = createMockInteraction();

        const result = (service as any).buildRespondedInteraction(
          interaction,
          { body: 'ya arranque', messageId: 'SM999' },
          {
            statusIntent: ResponseIntent.STARTED,
            confidence: 0.9,
            viability: null,
            optOut: false,
            escalate: false,
          },
          ResponseIntent.STARTED,
        );

        expect(result.status).toBe(InteractionStatus.RESPONDED);
        expect(result.responseIntent).toBe(ResponseIntent.STARTED);
        expect(result.responseContent).toBe('ya arranque');
        expect(result.metadata).toEqual(
          expect.objectContaining({
            inboundMessageSid: 'SM999',
            rawClassifierIntent: ResponseIntent.STARTED,
            classifierConfidence: 0.9,
          }),
        );
      });

      it('is pure: does not call the repository or any other side effect', () => {
        const interaction = createMockInteraction();

        (service as any).buildRespondedInteraction(
          interaction,
          { body: 'ok', messageId: 'SM1' },
          {
            statusIntent: ResponseIntent.UNKNOWN,
            confidence: 1,
            viability: null,
            optOut: false,
            escalate: false,
          },
          ResponseIntent.UNKNOWN,
        );

        expect(mockInteractionRepository.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('sendMessage (WhatsApp opt-out gate)', () => {
    let service: RequestInteractionService;
    let mockInteractionRepository: any;
    let mockRequestRepository: any;
    let mockWhatsAppMessaging: any;
    let mockUserService: any;

    const buildInteraction = () =>
      createMockInteraction({
        requestId: 'request-123',
        status: InteractionStatus.PENDING,
        direction: InteractionDirection.TO_CLIENT,
      });

    beforeEach(() => {
      mockInteractionRepository = {
        findById: jest.fn().mockImplementation(() => buildInteraction()),
        save: jest.fn((i) => Promise.resolve(i)),
      };
      mockRequestRepository = {
        findById: jest
          .fn()
          .mockResolvedValue(
            createMockRequest({ id: 'request-123', clientId: 'client-1' }),
          ),
      };
      mockWhatsAppMessaging = { sendMessage: jest.fn() };
      mockUserService = { findById: jest.fn() };

      service = new RequestInteractionService(
        mockInteractionRepository,
        mockRequestRepository,
        mockWhatsAppMessaging,
        mockUserService,
        {} as any,
        {} as any,
        { detectIntent: jest.fn() } as any,
        { detectIntent: jest.fn() } as any,
        { getTemplate: jest.fn() } as any,
        { publish: jest.fn() } as any,
        { get: jest.fn((_k: string, def?: unknown) => def) } as any,
        { flag: jest.fn() } as any,
        { receiveInboundMessage: jest.fn() } as any,
      );
    });

    it('does not send and marks the interaction FAILED when the recipient opted out of WhatsApp', async () => {
      mockUserService.findById.mockResolvedValue({
        phone: '+5492944123456',
        phoneVerified: true,
        whatsappOptedOut: true,
      });

      await service.sendMessage('interaction-123');

      expect(mockWhatsAppMessaging.sendMessage).not.toHaveBeenCalled();
      expect(mockInteractionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InteractionStatus.FAILED }),
      );
    });

    it('sends normally when the recipient has not opted out', async () => {
      mockUserService.findById.mockResolvedValue({
        phone: '+5492944123456',
        phoneVerified: true,
        whatsappOptedOut: false,
      });
      mockWhatsAppMessaging.sendMessage.mockResolvedValue({
        messageId: 'SM999',
      });

      await service.sendMessage('interaction-123');

      expect(mockWhatsAppMessaging.sendMessage).toHaveBeenCalledWith(
        '+5492944123456',
        expect.any(String),
      );
    });
  });
});
