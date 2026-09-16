import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminWhatsAppService } from './admin-whatsapp.service';

describe('AdminWhatsAppService', () => {
  let service: AdminWhatsAppService;
  let mockQueryRepository: any;
  let mockInteractionRepository: any;
  let mockInteractionService: any;
  let mockFollowUpScheduler: any;
  let mockConfig: any;
  let mockRules: any[];
  const originalNodeEnv = process.env.NODE_ENV;

  const setDevMode = (on: boolean) => {
    process.env.NODE_ENV = on ? 'development' : 'production';
    mockConfig.get.mockImplementation((_key: string, def?: string) =>
      on ? 'local' : (def ?? 'twilio'),
    );
  };

  beforeEach(() => {
    mockQueryRepository = { findConversations: jest.fn() };
    mockInteractionRepository = {
      findByRequestId: jest.fn(),
      findMostRecentByRequestId: jest.fn(),
      findById: jest.fn(),
    };
    mockInteractionService = {
      processInboundMessage: jest.fn(),
    };
    mockFollowUpScheduler = { forceTriggerRule: jest.fn() };
    mockConfig = { get: jest.fn() };
    mockRules = [
      { getName: () => 'ACCEPTED_3_DAYS' },
      { getName: () => 'DONE_1_DAY' },
    ];

    service = new AdminWhatsAppService(
      mockQueryRepository,
      mockInteractionRepository,
      mockInteractionService,
      mockFollowUpScheduler,
      mockConfig,
      mockRules,
    );
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('isDevMode', () => {
    it('is true when NODE_ENV != production and WHATSAPP_PROVIDER=local', () => {
      setDevMode(true);
      expect(service.isDevMode()).toBe(true);
    });

    it('is false when NODE_ENV != production and WHATSAPP_PROVIDER=twilio', () => {
      process.env.NODE_ENV = 'development';
      mockConfig.get.mockReturnValue('twilio');
      expect(service.isDevMode()).toBe(false);
    });

    it('is false when NODE_ENV == production and WHATSAPP_PROVIDER=local', () => {
      process.env.NODE_ENV = 'production';
      mockConfig.get.mockReturnValue('local');
      expect(service.isDevMode()).toBe(false);
    });

    it('is false when NODE_ENV == production and WHATSAPP_PROVIDER=twilio', () => {
      setDevMode(false);
      expect(service.isDevMode()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('includes availableFollowUpRules when in dev mode', () => {
      setDevMode(true);

      expect(service.getConfig()).toEqual({
        devMode: true,
        availableFollowUpRules: ['ACCEPTED_3_DAYS', 'DONE_1_DAY'],
      });
    });

    it('omits availableFollowUpRules when not in dev mode', () => {
      setDevMode(false);

      expect(service.getConfig()).toEqual({
        devMode: false,
        availableFollowUpRules: undefined,
      });
    });
  });

  describe('listConversations', () => {
    it('computes skip from page/limit and delegates to the query repository', async () => {
      mockQueryRepository.findConversations.mockResolvedValue({
        items: [],
        total: 0,
      });

      await service.listConversations({ page: 3, limit: 10, search: 'foo' });

      expect(mockQueryRepository.findConversations).toHaveBeenCalledWith({
        skip: 20,
        take: 10,
        search: 'foo',
      });
    });
  });

  describe('getThread', () => {
    it('delegates to the interaction repository', async () => {
      mockInteractionRepository.findByRequestId.mockResolvedValue([]);

      await service.getThread('request-1');

      expect(mockInteractionRepository.findByRequestId).toHaveBeenCalledWith(
        'request-1',
      );
    });
  });

  describe('simulateReply', () => {
    it('throws NotFoundException when not in dev mode', async () => {
      setDevMode(false);

      await expect(service.simulateReply('request-1', 'hola')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when there is no interaction for the request', async () => {
      setDevMode(true);
      mockInteractionRepository.findMostRecentByRequestId.mockResolvedValue(
        null,
      );

      await expect(service.simulateReply('request-1', 'hola')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the last interaction has no recipientPhone', async () => {
      setDevMode(true);
      mockInteractionRepository.findMostRecentByRequestId.mockResolvedValue({
        id: 'interaction-1',
        metadata: {},
        twilioMessageSid: 'SM123',
      });

      await expect(service.simulateReply('request-1', 'hola')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the last interaction was never actually sent', async () => {
      setDevMode(true);
      mockInteractionRepository.findMostRecentByRequestId.mockResolvedValue({
        id: 'interaction-1',
        metadata: { recipientPhone: '+5492944123456' },
        twilioMessageSid: null,
      });

      await expect(service.simulateReply('request-1', 'hola')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('calls processInboundMessage with the real SID and re-fetches the interaction (happy path)', async () => {
      setDevMode(true);
      const last = {
        id: 'interaction-1',
        metadata: { recipientPhone: '+5492944123456' },
        twilioMessageSid: 'SM123',
      };
      const updated = { ...last, responseContent: 'hola' };
      mockInteractionRepository.findMostRecentByRequestId.mockResolvedValue(
        last,
      );
      mockInteractionRepository.findById.mockResolvedValue(updated);

      const result = await service.simulateReply('request-1', 'hola');

      expect(mockInteractionService.processInboundMessage).toHaveBeenCalledWith(
        {
          from: 'whatsapp:+5492944123456',
          body: 'hola',
          messageId: 'SM123',
        },
      );
      expect(mockInteractionRepository.findById).toHaveBeenCalledWith(
        'interaction-1',
      );
      expect(result).toEqual(updated);
    });
  });

  describe('triggerFollowUp', () => {
    it('throws NotFoundException when not in dev mode', async () => {
      setDevMode(false);

      await expect(
        service.triggerFollowUp('request-1', 'ACCEPTED_3_DAYS'),
      ).rejects.toThrow(NotFoundException);

      expect(mockFollowUpScheduler.forceTriggerRule).not.toHaveBeenCalled();
    });

    it('delegates to FollowUpSchedulerJob.forceTriggerRule when in dev mode', async () => {
      setDevMode(true);
      mockFollowUpScheduler.forceTriggerRule.mockResolvedValue({
        interactionId: 'interaction-1',
      });

      const result = await service.triggerFollowUp(
        'request-1',
        'ACCEPTED_3_DAYS',
      );

      expect(mockFollowUpScheduler.forceTriggerRule).toHaveBeenCalledWith(
        'ACCEPTED_3_DAYS',
        'request-1',
      );
      expect(result).toEqual({ interactionId: 'interaction-1' });
    });
  });
});
