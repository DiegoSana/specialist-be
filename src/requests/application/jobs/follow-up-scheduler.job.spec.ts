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

  beforeEach(() => {
    mockInteractionRepository = {
      hasPendingFollowUp: jest.fn(),
      findMostRecentByRequestId: jest.fn(),
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
    mockQueryExecutor = { getRequests: jest.fn() };

    mockRule = {
      getName: jest.fn().mockReturnValue('ACCEPTED_3_DAYS'),
      getQuery: jest.fn().mockReturnValue({
        type: 'BY_STATUS',
        status: RequestStatus.ACCEPTED,
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
        status: RequestStatus.ACCEPTED,
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
      const request = createMockRequest({ status: RequestStatus.PENDING });
      mockRequestRepository.findById.mockResolvedValue(request);

      await expect(
        job.forceTriggerRule('ACCEPTED_3_DAYS', request.id),
      ).rejects.toThrow(BadRequestException);

      expect(mockInteractionService.createFollowUp).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when the recipient has no verified phone', async () => {
      const request = createMockRequest({
        status: RequestStatus.ACCEPTED,
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
});
