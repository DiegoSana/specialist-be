import { AdminVerificationService } from './admin-verification.service';

describe('AdminVerificationService', () => {
  let service: AdminVerificationService;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = { get: jest.fn() };
    service = new AdminVerificationService(mockConfig);
  });

  describe('getConfig', () => {
    it('defaults to provider=twilio with no devCode when VERIFICATION_PROVIDER is unset', () => {
      mockConfig.get.mockImplementation(
        (_key: string, def?: string) => def ?? 'twilio',
      );

      expect(service.getConfig()).toEqual({
        provider: 'twilio',
        devCode: undefined,
      });
    });

    it('reports provider=local with the fixed dev OTP code when VERIFICATION_PROVIDER=local', () => {
      mockConfig.get.mockReturnValue('local');

      expect(service.getConfig()).toEqual({
        provider: 'local',
        devCode: '000000',
      });
    });

    it('never includes devCode when provider=twilio', () => {
      mockConfig.get.mockReturnValue('twilio');

      const config = service.getConfig();

      expect(config.provider).toBe('twilio');
      expect(config.devCode).toBeUndefined();
    });
  });
});
