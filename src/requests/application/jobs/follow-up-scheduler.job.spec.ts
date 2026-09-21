import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RequestStatus, InteractionDirection } from '@prisma/client';
import { FollowUpSchedulerJob } from './follow-up-scheduler.job';
import { createMockRequest } from '../../../__mocks__/test-utils';

describe('FollowUpSchedulerJob', () => {
  let job: FollowUpSchedulerJob;
  let mockInteractionRepository: any;
  let mockRequestRepository: any;
  let mockInteractionService: any;
  let mockConfig: any;
  let mockUserService: any;
  let mockProfessionalService: any;
  let mockCompanyService: any;
  let mockQueryExecutor: any;
  let mockRule: any;
  let mockAttentionService: any;
  let mockSupportConversationService: any;

  beforeEach(() => {
    mockInteractionRepository = {
      hasPendingFollowUp: jest.fn().mockResolvedValue(false),
      findMostRecentByRequestId: jest.fn().mockResolvedValue(null),
      hasRespondedInteraction: jest.fn().mockResolvedValue(false),
    };
    mockRequestRepository = {
      findById: jest.fn(),
    };
    mockInteractionService = {
      createFollowUp: jest.fn(),
      sendMessage: jest.fn(),
    };
    mockConfig = { get: jest.fn().mockReturnValue('false') };
    mockUserService = { findById: jest.fn() };
    mockProfessionalService = { findByServiceProviderId: jest.fn() };
    mockCompanyService = { findByServiceProviderId: jest.fn() };
    mockQueryExecutor = { getRequests: jest.fn().mockResolvedValue([]) };
    mockAttentionService = { flag: jest.fn() };
    mockSupportConversationService = {
      hasOpenConversation: jest.fn().mockResolvedValue(false),
    };

    mockRule = {
      getName: jest.fn().mockReturnValue('ACCEPTED_3_DAYS'),
      getQuery: jest.fn().mockReturnValue({
        type: 'BY_STATUS',
        status: RequestStatus.CONTACT_RELEASED,
        days: 3,
      }),
      getDirection: jest.fn().mockReturnValue(InteractionDirection.TO_PROVIDER),
      getTemplate: jest.fn().mockReturnValue('follow_up_3_days'),
      buildPayload: jest.fn().mockResolvedValue({
        metadata: { rule: 'ACCEPTED_3_DAYS' },
        templateVariables: { title: 'Test' },
      }),
    };

    job = new FollowUpSchedulerJob(
      [mockRule],
      mockQueryExecutor,
      mockInteractionRepository,
      mockRequestRepository,
      mockInteractionService,
      mockConfig,
      mockUserService,
      mockProfessionalService,
      mockCompanyService,
      mockAttentionService,
      mockSupportConversationService,
    );
  });

  describe('getAvailableRuleNames', () => {
    it('should return the names of all injected rules', () => {
      expect(job.getAvailableRuleNames()).toEqual(['ACCEPTED_3_DAYS']);
    });
  });

  describe('forceTriggerRule', () => {
    it('should create and immediately send a follow-up when the request is eligible (happy path)', async () => {
      const request = createMockRequest({
        status: RequestStatus.CONTACT_RELEASED,
        providerId: 'service-provider-123',
      });
      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue({
        userId: 'user-1',
      });
      mockUserService.findById.mockResolvedValue({
        phone: '+5492944123456',
        phoneVerified: true,
      });
      mockInteractionService.createFollowUp.mockResolvedValue({
        id: 'interaction-1',
      });

      const result = await job.forceTriggerRule('ACCEPTED_3_DAYS', request.id);

      expect(result).toEqual({ interactionId: 'interaction-1' });
      expect(mockInteractionService.createFollowUp).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: request.id,
          direction: InteractionDirection.TO_PROVIDER,
          messageTemplate: 'follow_up_3_days',
        }),
      );
      expect(mockInteractionService.sendMessage).toHaveBeenCalledWith(
        'interaction-1',
      );
      // Deliberately does not consult hasPendingFollowUp / recent-interaction guards.
      expect(
        mockInteractionRepository.hasPendingFollowUp,
      ).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for an unknown rule name', async () => {
      await expect(
        job.forceTriggerRule('NOT_A_REAL_RULE', 'request-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockRequestRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the request does not exist', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

      await expect(
        job.forceTriggerRule('ACCEPTED_3_DAYS', 'missing-request'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when the request status does not match a BY_STATUS rule', async () => {
      const request = createMockRequest({ status: RequestStatus.PUBLISHED });
      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(
        job.forceTriggerRule('ACCEPTED_3_DAYS', request.id),
      ).rejects.toThrow(BadRequestException);

      expect(mockInteractionService.createFollowUp).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when the recipient has no verified phone', async () => {
      const request = createMockRequest({
        status: RequestStatus.CONTACT_RELEASED,
        providerId: 'service-provider-123',
      });
      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue(null);
      mockCompanyService.findByServiceProviderId.mockResolvedValue(null);

      await expect(
        job.forceTriggerRule('ACCEPTED_3_DAYS', request.id),
      ).rejects.toThrow(BadRequestException);

      expect(mockInteractionService.createFollowUp).not.toHaveBeenCalled();
    });
  });

  describe('scheduleFollowUps (open support conversation guard)', () => {
    const request = createMockRequest({
      status: RequestStatus.CONTACT_RELEASED,
      providerId: 'service-provider-123',
    });

    beforeEach(() => {
      mockConfig.get.mockImplementation((key: string, def?: string) =>
        key === 'WHATSAPP_FOLLOWUP_ENABLED' ? 'true' : def,
      );
      mockQueryExecutor.getRequests.mockResolvedValue([request]);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue({
        userId: 'provider-user-1',
      });
      mockUserService.findById.mockResolvedValue({
        phone: '+5492944123456',
        phoneVerified: true,
        whatsappOptedOut: false,
      });
    });

    it('skips scheduling while the recipient phone has an OPEN support conversation', async () => {
      mockSupportConversationService.hasOpenConversation.mockResolvedValue(
        true,
      );

      await job.scheduleFollowUps();

      expect(
        mockSupportConversationService.hasOpenConversation,
      ).toHaveBeenCalledWith('+5492944123456');
      expect(mockInteractionService.createFollowUp).not.toHaveBeenCalled();
    });

    it('schedules normally when there is no open support conversation', async () => {
      await job.scheduleFollowUps();

      expect(mockInteractionService.createFollowUp).toHaveBeenCalledTimes(1);
    });

    it('forceTriggerRule ignores the guard (explicit admin action)', async () => {
      mockSupportConversationService.hasOpenConversation.mockResolvedValue(
        true,
      );
      mockRequestRepository.findById.mockResolvedValue(request);
      mockInteractionService.createFollowUp.mockResolvedValue({ id: 'i-1' });

      await job.forceTriggerRule('ACCEPTED_3_DAYS', request.id);

      expect(mockInteractionService.sendMessage).toHaveBeenCalledWith('i-1');
    });
  });

  describe('scheduleFollowUps (ladder-exhausted attention flag)', () => {
    const eligibleRequest = createMockRequest({
      status: RequestStatus.CONTACT_RELEASED,
      providerId: 'service-provider-123',
    });

    beforeEach(() => {
      mockConfig.get.mockImplementation((key: string, def?: string) =>
        key === 'WHATSAPP_FOLLOWUP_ENABLED' ? 'true' : def,
      );
      mockQueryExecutor.getRequests.mockResolvedValue([eligibleRequest]);
      mockProfessionalService.findByServiceProviderId.mockResolvedValue({
        userId: 'provider-user-1',
      });
      mockUserService.findById.mockResolvedValue({
        phone: '+5492944123456',
        phoneVerified: true,
        whatsappOptedOut: false,
      });
    });

    it('flags the request AT_RISK when this is the only (thus last) rule for its status and it never got a response', async () => {
      mockInteractionRepository.hasRespondedInteraction.mockResolvedValue(
        false,
      );

      await job.scheduleFollowUps();

      expect(mockAttentionService.flag).toHaveBeenCalledWith(
        eligibleRequest.id,
        'AT_RISK',
        expect.any(String),
      );
    });

    it('does not flag when the request already had a RESPONDED interaction', async () => {
      mockInteractionRepository.hasRespondedInteraction.mockResolvedValue(true);

      await job.scheduleFollowUps();

      expect(mockAttentionService.flag).not.toHaveBeenCalled();
    });

    it('does not flag when another rule for the same status has a higher `days` (this is not the last rung)', async () => {
      const laterRule = {
        getName: jest.fn().mockReturnValue('ACCEPTED_7_DAYS'),
        getQuery: jest.fn().mockReturnValue({
          type: 'BY_STATUS',
          status: RequestStatus.CONTACT_RELEASED,
          days: 7,
        }),
        getDirection: jest
          .fn()
          .mockReturnValue(InteractionDirection.TO_PROVIDER),
        getTemplate: jest.fn().mockReturnValue('follow_up_7_days'),
        buildPayload: jest.fn().mockResolvedValue({ metadata: {} }),
      };
      job = new FollowUpSchedulerJob(
        [mockRule, laterRule],
        mockQueryExecutor,
        mockInteractionRepository,
        mockRequestRepository,
        mockInteractionService,
        mockConfig,
        mockUserService,
        mockProfessionalService,
        mockCompanyService,
        mockAttentionService,
        mockSupportConversationService,
      );
      // Only the non-last rule (days=3) gets a candidate; the last rung (days=7)
      // gets none, so this isolates "is mockRule's own scheduling flagging?"
      // from "does the ladder's actual last rung flag?" (covered by the first test).
      mockQueryExecutor.getRequests.mockImplementation((query: any) =>
        Promise.resolve(query.days === 3 ? [eligibleRequest] : []),
      );
      mockInteractionRepository.hasRespondedInteraction.mockResolvedValue(
        false,
      );

      await job.scheduleFollowUps();

      expect(mockAttentionService.flag).not.toHaveBeenCalled();
    });
  });
});
