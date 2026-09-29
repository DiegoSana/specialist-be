import { LocalVerificationService } from './local-verification.service';

describe('LocalVerificationService', () => {
  let service: LocalVerificationService;

  beforeEach(() => {
    service = new LocalVerificationService();
  });

  describe('requestPhoneVerification', () => {
    it('should return a local- prefixed session id without any network call', async () => {
      const sessionId =
        await service.requestPhoneVerification('+5492944123456');

      expect(sessionId).toMatch(/^local-[0-9a-f-]{36}$/);
    });

    it('should generate a different session id on every call', async () => {
      const first = await service.requestPhoneVerification('+5492944123456');
      const second = await service.requestPhoneVerification('+5492944123456');

      expect(first).not.toEqual(second);
    });
  });

  describe('confirmPhoneVerification', () => {
    it('should accept the fixed dev code', async () => {
      const result = await service.confirmPhoneVerification(
        '+5492944123456',
        LocalVerificationService.DEV_CODE,
      );

      expect(result).toBe(true);
    });

    it('should reject any other code', async () => {
      const result = await service.confirmPhoneVerification(
        '+5492944123456',
        '111111',
      );

      expect(result).toBe(false);
    });
  });

  describe('requestEmailVerification', () => {
    it('should return a local- prefixed session id without any network call', async () => {
      const sessionId =
        await service.requestEmailVerification('user@example.com');

      expect(sessionId).toMatch(/^local-[0-9a-f-]{36}$/);
    });
  });

  describe('confirmEmailVerification', () => {
    it('should accept the fixed dev code', async () => {
      const result = await service.confirmEmailVerification(
        'user@example.com',
        LocalVerificationService.DEV_CODE,
      );

      expect(result).toBe(true);
    });

    it('should reject any other code', async () => {
      const result = await service.confirmEmailVerification(
        'user@example.com',
        'wrong',
      );

      expect(result).toBe(false);
    });
  });
});
