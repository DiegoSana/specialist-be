import { ForbiddenException } from '@nestjs/common';
import { CompanyService } from './company.service';
import {
  CompanyEntity,
  CompanyStatus,
} from '../../domain/entities/company.entity';
import { CompanyStatusChangedEvent } from '../../domain/events/company-status-changed.event';
import { createMockUser } from '../../../__mocks__/test-utils';
import { UserStatus } from '@prisma/client';

describe('CompanyService status change events', () => {
  let service: CompanyService;
  let mockCompanyRepository: any;
  let mockProfileToggleService: any;
  let mockEventBus: any;

  const buildCompany = (status: CompanyStatus) =>
    ({
      id: 'company-1',
      userId: 'owner-1',
      companyName: 'Remodelaciones Express',
      status,
      isPending: () => status === CompanyStatus.PENDING_VERIFICATION,
      canChangeStatusBy: (ctx: { isAdmin: boolean }) => ctx.isAdmin,
    }) as unknown as CompanyEntity;

  const admin = createMockUser({ isAdmin: true });

  beforeEach(() => {
    mockCompanyRepository = { findById: jest.fn(), updateStatus: jest.fn() };
    mockProfileToggleService = { handleCompanyVerification: jest.fn() };
    mockEventBus = { publish: jest.fn() };

    service = new CompanyService(
      mockCompanyRepository,
      {} as any,
      {} as any,
      {} as any,
      mockProfileToggleService,
      mockEventBus,
    );
  });

  describe('verifyCompany', () => {
    it('publishes CompanyStatusChangedEvent when a pending company is verified', async () => {
      mockCompanyRepository.findById.mockResolvedValue(
        buildCompany(CompanyStatus.PENDING_VERIFICATION),
      );
      mockProfileToggleService.handleCompanyVerification.mockResolvedValue({
        company: buildCompany(CompanyStatus.ACTIVE),
      });

      await service.verifyCompany(admin, 'company-1');

      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      const event = mockEventBus.publish.mock
        .calls[0][0] as CompanyStatusChangedEvent;
      expect(event.name).toBe(CompanyStatusChangedEvent.EVENT_NAME);
      expect(event.payload).toMatchObject({
        companyId: 'company-1',
        userId: 'owner-1',
        previousStatus: CompanyStatus.PENDING_VERIFICATION,
        newStatus: CompanyStatus.ACTIVE,
      });
    });
  });

  describe('updateStatus', () => {
    it('publishes the event when the status changes', async () => {
      mockCompanyRepository.findById.mockResolvedValue(
        buildCompany(CompanyStatus.ACTIVE),
      );
      mockCompanyRepository.updateStatus.mockResolvedValue(
        buildCompany(CompanyStatus.SUSPENDED),
      );

      await service.updateStatus('company-1', CompanyStatus.SUSPENDED, admin);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            previousStatus: CompanyStatus.ACTIVE,
            newStatus: CompanyStatus.SUSPENDED,
          }),
        }),
      );
    });

    it('does not publish when the status is unchanged', async () => {
      mockCompanyRepository.findById.mockResolvedValue(
        buildCompany(CompanyStatus.ACTIVE),
      );
      mockCompanyRepository.updateStatus.mockResolvedValue(
        buildCompany(CompanyStatus.ACTIVE),
      );

      await service.updateStatus('company-1', CompanyStatus.ACTIVE, admin);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('createProfile', () => {
    const createDto = {
      companyName: 'Remodelaciones Express',
      tradeIds: ['trade-1'],
    };

    let mockUserService: any;
    let mockTradeRepository: any;
    let createProfileService: CompanyService;

    beforeEach(() => {
      mockUserService = { findByIdOrFail: jest.fn(), findById: jest.fn() };
      mockTradeRepository = { findById: jest.fn() };
      mockCompanyRepository = {
        ...mockCompanyRepository,
        findByUserId: jest.fn(),
        findByTaxId: jest.fn(),
        save: jest.fn(),
        updateTrades: jest.fn(),
      };

      createProfileService = new CompanyService(
        mockCompanyRepository,
        {} as any,
        mockUserService,
        mockTradeRepository,
        mockProfileToggleService,
        mockEventBus,
      );
    });

    it('throws ForbiddenException for a pure client (no provider profile yet)', async () => {
      const pureClient = createMockUser({
        status: UserStatus.ACTIVE,
        hasClientProfile: true,
        hasProfessionalProfile: false,
        hasCompanyProfile: false,
      });
      mockUserService.findByIdOrFail.mockResolvedValue(pureClient);

      await expect(
        createProfileService.createProfile('user-123', createDto as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockCompanyRepository.findByUserId).not.toHaveBeenCalled();
    });

    it('allows a client who already has a professional profile to create a company profile', async () => {
      const clientWithProfessional = createMockUser({
        id: 'user-123',
        status: UserStatus.ACTIVE,
        hasClientProfile: true,
        hasProfessionalProfile: true,
        hasCompanyProfile: false,
      });
      const updatedUser = createMockUser({
        id: 'user-123',
        status: UserStatus.ACTIVE,
        hasClientProfile: true,
        hasProfessionalProfile: true,
        hasCompanyProfile: true,
      });
      const savedCompany = buildCompany(CompanyStatus.PENDING_VERIFICATION);

      mockUserService.findByIdOrFail.mockResolvedValue(clientWithProfessional);
      mockUserService.findById.mockResolvedValue(updatedUser);
      mockCompanyRepository.findByUserId.mockResolvedValue(null);
      mockTradeRepository.findById.mockResolvedValue({
        id: 'trade-1',
        name: 'Electricista',
        category: null,
        description: null,
      });
      mockCompanyRepository.save.mockResolvedValue(savedCompany);
      mockCompanyRepository.updateTrades.mockResolvedValue(undefined);

      const result = await createProfileService.createProfile(
        'user-123',
        createDto as any,
      );

      expect(result).toHaveProperty('company');
      expect(mockCompanyRepository.save).toHaveBeenCalled();
    });
  });
});
