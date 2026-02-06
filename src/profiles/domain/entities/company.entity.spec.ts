import {
  CompanyEntity,
  CompanyStatus,
  CompanyAuthContext,
  TradeInfo,
} from './company.entity';
import { ServiceProviderEntity, ProviderType } from './service-provider.entity';

const createMockTrade = (overrides?: Partial<TradeInfo>): TradeInfo => ({
  id: 'trade-123',
  name: 'Plumbing',
  category: 'Home Services',
  description: 'Plumbing services',
  isPrimary: false,
  ...overrides,
});

const createMockCompany = (overrides?: Partial<CompanyEntity>): CompanyEntity => {
  const defaults = {
    id: 'company-123',
    userId: 'user-123',
    serviceProviderId: 'sp-123',
    companyName: 'Test Company',
    legalName: 'Test Company LLC',
    taxId: '12-3456789',
    trades: [createMockTrade({ isPrimary: true })],
    description: 'A test company',
    foundedYear: 2020,
    employeeCount: '6-20',
    website: 'https://test.com',
    address: '123 Test St',
    city: 'Buenos Aires',
    zone: 'Palermo',
    status: CompanyStatus.VERIFIED,
    profileImage: 'https://test.com/logo.png',
    gallery: ['https://test.com/img1.png', 'https://test.com/img2.png'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };

  return new CompanyEntity(
    overrides?.id ?? defaults.id,
    overrides?.userId ?? defaults.userId,
    overrides?.serviceProviderId ?? defaults.serviceProviderId,
    overrides?.companyName ?? defaults.companyName,
    overrides?.legalName ?? defaults.legalName,
    overrides?.taxId ?? defaults.taxId,
    overrides?.trades ?? defaults.trades,
    overrides?.description ?? defaults.description,
    overrides?.foundedYear ?? defaults.foundedYear,
    overrides?.employeeCount ?? defaults.employeeCount,
    overrides?.website ?? defaults.website,
    overrides?.address ?? defaults.address,
    overrides?.city ?? defaults.city,
    overrides?.zone ?? defaults.zone,
    overrides?.status ?? defaults.status,
    overrides?.profileImage ?? defaults.profileImage,
    overrides?.gallery ?? defaults.gallery,
    overrides?.createdAt ?? defaults.createdAt,
    overrides?.updatedAt ?? defaults.updatedAt,
    overrides?.serviceProvider,
    overrides?.user,
  );
};

describe('CompanyEntity', () => {
  describe('constructor', () => {
    it('should create a company entity with all fields', () => {
      const company = createMockCompany();

      expect(company.id).toBe('company-123');
      expect(company.userId).toBe('user-123');
      expect(company.serviceProviderId).toBe('sp-123');
      expect(company.companyName).toBe('Test Company');
      expect(company.legalName).toBe('Test Company LLC');
      expect(company.taxId).toBe('12-3456789');
      expect(company.trades).toHaveLength(1);
      expect(company.description).toBe('A test company');
      expect(company.foundedYear).toBe(2020);
      expect(company.employeeCount).toBe('6-20');
      expect(company.website).toBe('https://test.com');
      expect(company.address).toBe('123 Test St');
      expect(company.city).toBe('Buenos Aires');
      expect(company.zone).toBe('Palermo');
      expect(company.status).toBe(CompanyStatus.VERIFIED);
      expect(company.profileImage).toBe('https://test.com/logo.png');
      expect(company.gallery).toHaveLength(2);
    });
  });

  describe('computed properties', () => {
    describe('primaryTrade', () => {
      it('should return the primary trade', () => {
        const trades = [
          createMockTrade({ id: '1', name: 'Plumbing', isPrimary: false }),
          createMockTrade({ id: '2', name: 'Electrical', isPrimary: true }),
        ];
        const company = createMockCompany({ trades });

        expect(company.primaryTrade?.id).toBe('2');
        expect(company.primaryTrade?.name).toBe('Electrical');
      });

      it('should return first trade if no primary is set', () => {
        const trades = [
          createMockTrade({ id: '1', name: 'Plumbing', isPrimary: false }),
          createMockTrade({ id: '2', name: 'Electrical', isPrimary: false }),
        ];
        const company = createMockCompany({ trades });

        expect(company.primaryTrade?.id).toBe('1');
      });

      it('should return null if no trades exist', () => {
        const company = createMockCompany({ trades: [] });
        expect(company.primaryTrade).toBeNull();
      });
    });

    describe('tradeIds', () => {
      it('should return array of trade IDs', () => {
        const trades = [
          createMockTrade({ id: 'trade-1' }),
          createMockTrade({ id: 'trade-2' }),
        ];
        const company = createMockCompany({ trades });

        expect(company.tradeIds).toEqual(['trade-1', 'trade-2']);
      });

      it('should return empty array if no trades', () => {
        const company = createMockCompany({ trades: [] });
        expect(company.tradeIds).toEqual([]);
      });
    });

    describe('displayName', () => {
      it('should return company name', () => {
        const company = createMockCompany({ companyName: 'Acme Corp' });
        expect(company.displayName).toBe('Acme Corp');
      });
    });

    describe('rating properties', () => {
      it('should return 0 if no service provider', () => {
        const company = createMockCompany();
        expect(company.averageRating).toBe(0);
        expect(company.totalReviews).toBe(0);
      });

      it('should delegate to service provider when present', () => {
        const serviceProvider = new ServiceProviderEntity(
          'sp-123',
          ProviderType.COMPANY,
          4.5,
          10,
          new Date(),
          new Date(),
        );
        const company = createMockCompany({ serviceProvider });

        expect(company.averageRating).toBe(4.5);
        expect(company.totalReviews).toBe(10);
      });
    });
  });

  describe('status methods', () => {
    it('should identify verified status', () => {
      const company = createMockCompany({ status: CompanyStatus.VERIFIED });

      expect(company.hasVerifiedBadge()).toBe(true);
      expect(company.isPending()).toBe(false);
      expect(company.isRejected()).toBe(false);
      expect(company.canOperate()).toBe(true);
    });

    it('should identify pending status', () => {
      const company = createMockCompany({ status: CompanyStatus.PENDING_VERIFICATION });

      expect(company.hasVerifiedBadge()).toBe(false);
      expect(company.isPending()).toBe(true);
      expect(company.isRejected()).toBe(false);
      expect(company.canOperate()).toBe(false);
    });

    it('should identify rejected status', () => {
      const company = createMockCompany({ status: CompanyStatus.REJECTED });

      expect(company.hasVerifiedBadge()).toBe(false);
      expect(company.isPending()).toBe(false);
      expect(company.isRejected()).toBe(true);
      expect(company.canOperate()).toBe(false);
    });

    it('should check canOperate (isActive) from status', () => {
      const activeCompany = createMockCompany({ status: CompanyStatus.VERIFIED });
      const inactiveCompany = createMockCompany({ status: CompanyStatus.INACTIVE });

      expect(activeCompany.canOperate()).toBe(true);
      expect(activeCompany.isActive()).toBe(true);
      expect(inactiveCompany.canOperate()).toBe(false);
      expect(inactiveCompany.isActive()).toBe(false);
    });

    it('should check active and verified status', () => {
      const activeVerified = createMockCompany({
        status: CompanyStatus.VERIFIED,
      });
      const pending = createMockCompany({
        status: CompanyStatus.PENDING_VERIFICATION,
      });
      const inactive = createMockCompany({
        status: CompanyStatus.INACTIVE,
      });

      expect(activeVerified.isActiveAndVerified()).toBe(true);
      expect(pending.isActiveAndVerified()).toBe(false);
      expect(inactive.isActiveAndVerified()).toBe(false);
    });
  });

  describe('authorization methods', () => {
    describe('isOwnedBy', () => {
      it('should return true for owner', () => {
        const company = createMockCompany({ userId: 'user-123' });
        expect(company.isOwnedBy('user-123')).toBe(true);
      });

      it('should return false for non-owner', () => {
        const company = createMockCompany({ userId: 'user-123' });
        expect(company.isOwnedBy('other-user')).toBe(false);
      });
    });

    describe('canViewFullProfileBy', () => {
      it('should allow owner to view full profile', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'user-123', isAdmin: false };

        expect(company.canViewFullProfileBy(ctx)).toBe(true);
      });

      it('should allow admin to view full profile', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'other-user', isAdmin: true };

        expect(company.canViewFullProfileBy(ctx)).toBe(true);
      });

      it('should deny non-owner non-admin to view full profile', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'other-user', isAdmin: false };

        expect(company.canViewFullProfileBy(ctx)).toBe(false);
      });
    });

    describe('canBeEditedBy', () => {
      it('should allow owner to edit', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'user-123', isAdmin: false };

        expect(company.canBeEditedBy(ctx)).toBe(true);
      });

      it('should allow admin to edit', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'other-user', isAdmin: true };

        expect(company.canBeEditedBy(ctx)).toBe(true);
      });

      it('should deny non-owner non-admin to edit', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'other-user', isAdmin: false };

        expect(company.canBeEditedBy(ctx)).toBe(false);
      });
    });

    describe('canManageGalleryBy', () => {
      it('should allow owner to manage gallery', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'user-123', isAdmin: false };

        expect(company.canManageGalleryBy(ctx)).toBe(true);
      });

      it('should allow admin to manage gallery', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'other-user', isAdmin: true };

        expect(company.canManageGalleryBy(ctx)).toBe(true);
      });

      it('should deny non-owner non-admin to manage gallery', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'other-user', isAdmin: false };

        expect(company.canManageGalleryBy(ctx)).toBe(false);
      });
    });

    describe('canChangeStatusBy', () => {
      it('should allow admin to change status', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'other-user', isAdmin: true };

        expect(company.canChangeStatusBy(ctx)).toBe(true);
      });

      it('should deny owner to change status', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'user-123', isAdmin: false };

        expect(company.canChangeStatusBy(ctx)).toBe(false);
      });

      it('should deny non-admin to change status', () => {
        const company = createMockCompany({ userId: 'user-123' });
        const ctx: CompanyAuthContext = { userId: 'other-user', isAdmin: false };

        expect(company.canChangeStatusBy(ctx)).toBe(false);
      });
    });
  });

  describe('helper methods', () => {
    describe('buildAuthContext', () => {
      it('should create auth context', () => {
        const ctx = CompanyEntity.buildAuthContext('user-123', true);

        expect(ctx.userId).toBe('user-123');
        expect(ctx.isAdmin).toBe(true);
      });
    });

    describe('withServiceProvider', () => {
      it('should create new entity with service provider attached', () => {
        const company = createMockCompany();
        const serviceProvider = new ServiceProviderEntity(
          'sp-123',
          ProviderType.COMPANY,
          4.5,
          10,
          new Date(),
          new Date(),
        );

        const updated = company.withServiceProvider(serviceProvider);

        expect(updated.serviceProvider).toBe(serviceProvider);
        expect(updated.averageRating).toBe(4.5);
        expect(updated.totalReviews).toBe(10);
        // Original should be unchanged
        expect(company.serviceProvider).toBeUndefined();
      });

      it('should preserve all other fields', () => {
        const company = createMockCompany();
        const serviceProvider = ServiceProviderEntity.createForCompany('sp-123');

        const updated = company.withServiceProvider(serviceProvider);

        expect(updated.id).toBe(company.id);
        expect(updated.userId).toBe(company.userId);
        expect(updated.companyName).toBe(company.companyName);
        expect(updated.legalName).toBe(company.legalName);
        expect(updated.status).toBe(company.status);
        expect(updated.gallery).toEqual(company.gallery);
      });
    });
  });
});

