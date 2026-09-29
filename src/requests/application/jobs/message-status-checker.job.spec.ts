import { MessageStatusCheckerJob } from './message-status-checker.job';

describe('MessageStatusCheckerJob', () => {
  let job: MessageStatusCheckerJob;
  let mockInteractionRepository: any;
  let mockTwilioClientService: any;
  let mockInteractionService: any;
  let mockConfig: any;
  let mockTwilioClient: any;

  const buildInteraction = (overrides: Record<string, any> = {}) => ({
    id: 'interaction-1',
    twilioMessageSid: 'SM123',
    ...overrides,
  });

  beforeEach(() => {
    mockInteractionRepository = {
      findSentButNotDelivered: jest.fn().mockResolvedValue([]),
    };
    mockTwilioClient = {
      messages: jest.fn(),
    };
    mockTwilioClientService = {
      isInitialized: jest.fn().mockReturnValue(true),
      getClient: jest.fn().mockReturnValue(mockTwilioClient),
    };
    mockInteractionService = {
      markAsDelivered: jest.fn().mockResolvedValue(undefined),
    };
    mockConfig = {
      get: jest.fn().mockReturnValue('true'),
    };

    job = new MessageStatusCheckerJob(
      mockInteractionRepository,
      mockTwilioClientService,
      mockInteractionService,
      mockConfig,
    );
  });

  const mockTwilioFetch = (status: string, extra: Record<string, any> = {}) => {
    mockTwilioClient.messages.mockReturnValue({
      fetch: jest.fn().mockResolvedValue({ status, ...extra }),
    });
  };

  describe('checkMessageStatuses', () => {
    it('should call markAsDelivered when Twilio reports the message as delivered', async () => {
      const interaction = buildInteraction();
      mockInteractionRepository.findSentButNotDelivered.mockResolvedValue([
        interaction,
      ]);
      mockTwilioFetch('delivered');

      await job.checkMessageStatuses();

      expect(mockInteractionService.markAsDelivered).toHaveBeenCalledWith(
        'SM123',
        'delivered',
      );
    });

    it('should call markAsDelivered when Twilio reports the message as read', async () => {
      const interaction = buildInteraction();
      mockInteractionRepository.findSentButNotDelivered.mockResolvedValue([
        interaction,
      ]);
      mockTwilioFetch('read');

      await job.checkMessageStatuses();

      expect(mockInteractionService.markAsDelivered).toHaveBeenCalledWith(
        'SM123',
        'read',
      );
    });

    it('should call markAsDelivered when Twilio reports the message as failed', async () => {
      const interaction = buildInteraction();
      mockInteractionRepository.findSentButNotDelivered.mockResolvedValue([
        interaction,
      ]);
      mockTwilioFetch('failed', {
        errorCode: 30003,
        errorMessage: 'Unreachable',
      });

      await job.checkMessageStatuses();

      expect(mockInteractionService.markAsDelivered).toHaveBeenCalledWith(
        'SM123',
        'failed',
      );
    });

    it('should not call markAsDelivered for an in-flight status like "sent"', async () => {
      const interaction = buildInteraction();
      mockInteractionRepository.findSentButNotDelivered.mockResolvedValue([
        interaction,
      ]);
      mockTwilioFetch('sent');

      await job.checkMessageStatuses();

      expect(mockInteractionService.markAsDelivered).not.toHaveBeenCalled();
    });

    it('should do nothing when the job is disabled', async () => {
      mockConfig.get.mockReturnValue('false');
      job = new MessageStatusCheckerJob(
        mockInteractionRepository,
        mockTwilioClientService,
        mockInteractionService,
        mockConfig,
      );

      await job.checkMessageStatuses();

      expect(
        mockInteractionRepository.findSentButNotDelivered,
      ).not.toHaveBeenCalled();
    });

    it('should do nothing when the Twilio client is not initialized', async () => {
      mockTwilioClientService.isInitialized.mockReturnValue(false);

      await job.checkMessageStatuses();

      expect(
        mockInteractionRepository.findSentButNotDelivered,
      ).not.toHaveBeenCalled();
    });
  });
});
