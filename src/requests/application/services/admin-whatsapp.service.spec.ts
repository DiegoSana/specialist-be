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
    const configure = (values: {
      NODE_ENV?: string;
      WHATSAPP_PROVIDER?: string;
      WHATSAPP_DEV_MODE_ENABLED?: string;
      TWILIO_WHATSAPP_FROM?: string;
    }) => {
      process.env.NODE_ENV = values.NODE_ENV ?? 'development';
      mockConfig.get.mockImplementation((key: string, def?: string) =>
        key in values ? (values as any)[key] : def,
      );
    };

    it('includes availableFollowUpRules and omits twilio when in dev mode (provider=local)', () => {
      configure({ WHATSAPP_PROVIDER: 'local' });

      expect(service.getConfig()).toEqual({
        provider: 'local',
        devMode: true,
        availableFollowUpRules: ['ACCEPTED_3_DAYS', 'DONE_1_DAY'],
        twilio: undefined,
      });
    });

    it('includes availableFollowUpRules and reports the default sandbox number when provider=twilio and TWILIO_WHATSAPP_FROM is unset (outside dev mode)', () => {
      configure({ WHATSAPP_PROVIDER: 'twilio' });

      expect(service.getConfig()).toEqual({
        provider: 'twilio',
        devMode: false,
        availableFollowUpRules: ['ACCEPTED_3_DAYS', 'DONE_1_DAY'],
        twilio: {
          fromNumber: 'whatsapp:+14155238886',
          isDefaultSandboxNumber: true,
        },
      });
    });

    it('reports isDefaultSandboxNumber=false when TWILIO_WHATSAPP_FROM overrides the default', () => {
      configure({
        WHATSAPP_PROVIDER: 'twilio',
        TWILIO_WHATSAPP_FROM: 'whatsapp:+5492944000000',
      });

      expect(service.getConfig()).toEqual({
        provider: 'twilio',
        devMode: false,
        availableFollowUpRules: ['ACCEPTED_3_DAYS', 'DONE_1_DAY'],
        twilio: {
          fromNumber: 'whatsapp:+5492944000000',
          isDefaultSandboxNumber: false,
        },
      });
    });

    it('populates availableFollowUpRules even when devMode is false', () => {
      configure({ NODE_ENV: 'production', WHATSAPP_PROVIDER: 'twilio' });

      const config = service.getConfig();
      expect(config.devMode).toBe(false);
      expect(config.availableFollowUpRules).toEqual([
        'ACCEPTED_3_DAYS',
        'DONE_1_DAY',
      ]);
    });

    it('defaults provider to twilio when WHATSAPP_PROVIDER is unset', () => {
      configure({});

      expect(service.getConfig().provider).toBe('twilio');
    });

    it('never includes twilio config when provider=local, even outside dev mode', () => {
      configure({ NODE_ENV: 'production', WHATSAPP_PROVIDER: 'local' });

      const config = service.getConfig();
      expect(config.provider).toBe('local');
      expect(config.devMode).toBe(false);
      expect(config.twilio).toBeUndefined();
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

    it('does not throw and still delegates when WHATSAPP_PROVIDER is not local (any provider is allowed)', async () => {
      setDevMode(false);
      mockFollowUpScheduler.forceTriggerRule.mockResolvedValue({
        interactionId: 'interaction-2',
      });

      const result = await service.triggerFollowUp(
        'request-1',
        'ACCEPTED_3_DAYS',
      );

      expect(mockFollowUpScheduler.forceTriggerRule).toHaveBeenCalledWith(
        'ACCEPTED_3_DAYS',
        'request-1',
      );
      expect(result).toEqual({ interactionId: 'interaction-2' });
    });
  });
});
