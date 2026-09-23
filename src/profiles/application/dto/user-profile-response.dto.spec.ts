import { UserProfileResponseDto } from './user-profile-response.dto';
import { createMockUser } from '../../../__mocks__/test-utils';

describe('UserProfileResponseDto', () => {
  describe('fromEntity', () => {
    it('carries whatsappOptedOut and whatsappOptedOutAt from the entity', () => {
      const optedOutAt = new Date('2026-01-01T00:00:00.000Z');
      const user = createMockUser({
        whatsappOptedOut: true,
        whatsappOptedOutAt: optedOutAt,
      });

      const dto = UserProfileResponseDto.fromEntity(user);

      expect(dto.whatsappOptedOut).toBe(true);
      expect(dto.whatsappOptedOutAt).toBe(optedOutAt);
    });

    it('defaults to not opted out with a null timestamp', () => {
      const user = createMockUser({
        whatsappOptedOut: false,
        whatsappOptedOutAt: null,
      });

      const dto = UserProfileResponseDto.fromEntity(user);

      expect(dto.whatsappOptedOut).toBe(false);
      expect(dto.whatsappOptedOutAt).toBeNull();
    });
  });
});
