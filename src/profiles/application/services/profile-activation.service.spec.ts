import { ProfileActivationService } from './profile-activation.service';
import { createMockUser } from '../../../__mocks__/test-utils';

describe('ProfileActivationService', () => {
  let service: ProfileActivationService;
  let mockUserService: any;
  let mockProfessionalService: any;
  let mockCompanyService: any;

  beforeEach(() => {
    mockUserService = { findById: jest.fn() };
    mockProfessionalService = {
      findByUserId: jest.fn().mockRejectedValue(new Error('not found')),
    };
    mockCompanyService = {
      findByUserId: jest.fn().mockRejectedValue(new Error('not found')),
    };

    service = new ProfileActivationService(
      mockUserService,
      mockProfessionalService,
      mockCompanyService,
    );
  });

  it('is active for a fully verified client who has not opted out of WhatsApp', async () => {
    mockUserService.findById.mockResolvedValue(
      createMockUser({
        hasClientProfile: true,
        phoneVerified: true,
        emailVerified: true,
        whatsappOptedOut: false,
      }),
    );

    const status = await service.getActivationStatus('user-123');

    expect(status.hasActiveClientProfile).toBe(true);
  });

  it('is NOT active for an otherwise fully verified client who opted out of WhatsApp', async () => {
    mockUserService.findById.mockResolvedValue(
      createMockUser({
        hasClientProfile: true,
        phoneVerified: true,
        emailVerified: true,
        whatsappOptedOut: true,
      }),
    );

    const status = await service.getActivationStatus('user-123');

    expect(status.hasActiveClientProfile).toBe(false);
  });

  it('is NOT active for a provider who opted out of WhatsApp, even with an operable profile', async () => {
    mockUserService.findById.mockResolvedValue(
      createMockUser({
        hasClientProfile: false,
        phoneVerified: true,
        emailVerified: true,
        whatsappOptedOut: true,
      }),
    );
    mockProfessionalService.findByUserId.mockResolvedValue({
      canOperate: () => true,
      serviceProviderId: 'sp-123',
    });

    const status = await service.getActivationStatus('user-123');

    expect(status.hasActiveProviderProfile).toBe(false);
    expect(status.activeServiceProviderId).toBeNull();
  });

  it('is active for a provider who has not opted out, with an operable profile', async () => {
    mockUserService.findById.mockResolvedValue(
      createMockUser({
        hasClientProfile: false,
        phoneVerified: true,
        emailVerified: true,
        whatsappOptedOut: false,
      }),
    );
    mockProfessionalService.findByUserId.mockResolvedValue({
      canOperate: () => true,
      serviceProviderId: 'sp-123',
    });

    const status = await service.getActivationStatus('user-123');

    expect(status.hasActiveProviderProfile).toBe(true);
    expect(status.activeServiceProviderId).toBe('sp-123');
  });
});
