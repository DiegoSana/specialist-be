import { UserStatus } from '@prisma/client';
import { createMockUser } from '../../../__mocks__/test-utils';

describe('UserEntity', () => {
  describe('canCreateProfessionalProfile', () => {
    it('denies a pure client (client profile, no provider profile yet)', () => {
      const user = createMockUser({
        status: UserStatus.ACTIVE,
        hasClientProfile: true,
        hasProfessionalProfile: false,
        hasCompanyProfile: false,
      });

      expect(user.canCreateProfessionalProfile()).toBe(false);
    });

    it('allows a user with no profiles at all (professional-track signup)', () => {
      const user = createMockUser({
        status: UserStatus.ACTIVE,
        hasClientProfile: false,
        hasProfessionalProfile: false,
        hasCompanyProfile: false,
      });

      expect(user.canCreateProfessionalProfile()).toBe(true);
    });

    it('allows a client who already has a company profile', () => {
      const user = createMockUser({
        status: UserStatus.ACTIVE,
        hasClientProfile: true,
        hasProfessionalProfile: false,
        hasCompanyProfile: true,
      });

      expect(user.canCreateProfessionalProfile()).toBe(true);
    });

    it('denies an inactive user even without a client profile', () => {
      const user = createMockUser({
        status: UserStatus.SUSPENDED,
        hasClientProfile: false,
        hasProfessionalProfile: false,
        hasCompanyProfile: false,
      });
      jest.spyOn(user, 'isActive').mockReturnValue(false);

      expect(user.canCreateProfessionalProfile()).toBe(false);
    });
  });

  describe('canCreateCompanyProfile', () => {
    it('denies a pure client (client profile, no provider profile yet)', () => {
      const user = createMockUser({
        status: UserStatus.ACTIVE,
        hasClientProfile: true,
        hasProfessionalProfile: false,
        hasCompanyProfile: false,
      });

      expect(user.canCreateCompanyProfile()).toBe(false);
    });

    it('allows a user with no profiles at all', () => {
      const user = createMockUser({
        status: UserStatus.ACTIVE,
        hasClientProfile: false,
        hasProfessionalProfile: false,
        hasCompanyProfile: false,
      });

      expect(user.canCreateCompanyProfile()).toBe(true);
    });

    it('allows a client who already has a professional profile', () => {
      const user = createMockUser({
        status: UserStatus.ACTIVE,
        hasClientProfile: true,
        hasProfessionalProfile: true,
        hasCompanyProfile: false,
      });

      expect(user.canCreateCompanyProfile()).toBe(true);
    });

    it('denies an inactive user even without a client profile', () => {
      const user = createMockUser({
        status: UserStatus.SUSPENDED,
        hasClientProfile: false,
        hasProfessionalProfile: false,
        hasCompanyProfile: false,
      });
      jest.spyOn(user, 'isActive').mockReturnValue(false);

      expect(user.canCreateCompanyProfile()).toBe(false);
    });
  });
});
