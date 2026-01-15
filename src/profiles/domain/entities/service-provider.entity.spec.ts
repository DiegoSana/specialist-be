import { ServiceProviderEntity, ProviderType } from './service-provider.entity';

describe('ServiceProviderEntity', () => {
  describe('factory methods', () => {
    it('should create a professional service provider', () => {
      const id = 'sp-123';
      const now = new Date('2024-01-15T10:00:00Z');

      const provider = ServiceProviderEntity.createForProfessional(id, now);

      expect(provider.id).toBe(id);
      expect(provider.type).toBe(ProviderType.PROFESSIONAL);
      expect(provider.averageRating).toBe(0);
      expect(provider.totalReviews).toBe(0);
      expect(provider.createdAt).toEqual(now);
      expect(provider.updatedAt).toEqual(now);
    });

    it('should create a company service provider', () => {
      const id = 'sp-456';
      const now = new Date('2024-01-15T10:00:00Z');

      const provider = ServiceProviderEntity.createForCompany(id, now);

      expect(provider.id).toBe(id);
      expect(provider.type).toBe(ProviderType.COMPANY);
      expect(provider.averageRating).toBe(0);
      expect(provider.totalReviews).toBe(0);
      expect(provider.createdAt).toEqual(now);
      expect(provider.updatedAt).toEqual(now);
    });

    it('should use current date if not provided', () => {
      const before = new Date();
      const provider = ServiceProviderEntity.createForProfessional('sp-123');
      const after = new Date();

      expect(provider.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(provider.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('type checks', () => {
    it('should identify professional provider', () => {
      const provider = ServiceProviderEntity.createForProfessional('sp-123');

      expect(provider.isProfessional()).toBe(true);
      expect(provider.isCompany()).toBe(false);
    });

    it('should identify company provider', () => {
      const provider = ServiceProviderEntity.createForCompany('sp-123');

      expect(provider.isProfessional()).toBe(false);
      expect(provider.isCompany()).toBe(true);
    });
  });

  describe('capability checks', () => {
    it('should allow professional to receive requests', () => {
      const provider = ServiceProviderEntity.createForProfessional('sp-123');
      expect(provider.canReceiveRequests()).toBe(true);
    });

    it('should allow company to receive requests', () => {
      const provider = ServiceProviderEntity.createForCompany('sp-123');
      expect(provider.canReceiveRequests()).toBe(true);
    });

    it('should allow professional to be reviewed', () => {
      const provider = ServiceProviderEntity.createForProfessional('sp-123');
      expect(provider.canBeReviewed()).toBe(true);
    });

    it('should allow company to be reviewed', () => {
      const provider = ServiceProviderEntity.createForCompany('sp-123');
      expect(provider.canBeReviewed()).toBe(true);
    });
  });

  describe('rating calculations', () => {
    describe('calculateNewRating', () => {
      it('should calculate first rating correctly', () => {
        const provider = ServiceProviderEntity.createForProfessional('sp-123');

        const result = provider.calculateNewRating(5);

        expect(result.averageRating).toBe(5);
        expect(result.totalReviews).toBe(1);
      });

      it('should calculate subsequent ratings correctly', () => {
        const provider = new ServiceProviderEntity(
          'sp-123',
          ProviderType.PROFESSIONAL,
          4.5,
          2,
          new Date(),
          new Date(),
        );

        // (4.5 * 2 + 3) / 3 = 12 / 3 = 4
        const result = provider.calculateNewRating(3);

        expect(result.averageRating).toBe(4);
        expect(result.totalReviews).toBe(3);
      });

      it('should round to 2 decimal places', () => {
        const provider = new ServiceProviderEntity(
          'sp-123',
          ProviderType.PROFESSIONAL,
          4.5,
          2,
          new Date(),
          new Date(),
        );

        // (4.5 * 2 + 5) / 3 = 14 / 3 = 4.666...
        const result = provider.calculateNewRating(5);

        expect(result.averageRating).toBe(4.67);
        expect(result.totalReviews).toBe(3);
      });
    });

    describe('withUpdatedRating', () => {
      it('should return new entity with updated rating', () => {
        const now = new Date('2024-01-15T10:00:00Z');
        const provider = new ServiceProviderEntity(
          'sp-123',
          ProviderType.PROFESSIONAL,
          4.0,
          5,
          new Date('2024-01-01T00:00:00Z'),
          new Date('2024-01-10T00:00:00Z'),
        );

        const updated = provider.withUpdatedRating(5, now);

        // (4.0 * 5 + 5) / 6 = 25 / 6 = 4.166...
        expect(updated.averageRating).toBe(4.17);
        expect(updated.totalReviews).toBe(6);
        expect(updated.updatedAt).toEqual(now);
        // Original should be unchanged
        expect(provider.averageRating).toBe(4.0);
        expect(provider.totalReviews).toBe(5);
      });

      it('should preserve type and id', () => {
        const provider = ServiceProviderEntity.createForCompany('sp-123');
        const updated = provider.withUpdatedRating(5);

        expect(updated.id).toBe('sp-123');
        expect(updated.type).toBe(ProviderType.COMPANY);
      });
    });

    describe('withRemovedRating', () => {
      it('should recalculate rating when review is removed', () => {
        const now = new Date('2024-01-15T10:00:00Z');
        const provider = new ServiceProviderEntity(
          'sp-123',
          ProviderType.PROFESSIONAL,
          4.0,
          4,
          new Date('2024-01-01T00:00:00Z'),
          new Date('2024-01-10T00:00:00Z'),
        );

        // Remove a 5-star review: (4.0 * 4 - 5) / 3 = 11 / 3 = 3.666...
        const updated = provider.withRemovedRating(5, now);

        expect(updated.averageRating).toBe(3.67);
        expect(updated.totalReviews).toBe(3);
        expect(updated.updatedAt).toEqual(now);
      });

      it('should reset to zero when last review is removed', () => {
        const now = new Date('2024-01-15T10:00:00Z');
        const provider = new ServiceProviderEntity(
          'sp-123',
          ProviderType.PROFESSIONAL,
          5.0,
          1,
          new Date(),
          new Date(),
        );

        const updated = provider.withRemovedRating(5, now);

        expect(updated.averageRating).toBe(0);
        expect(updated.totalReviews).toBe(0);
        expect(updated.updatedAt).toEqual(now);
      });

      it('should reset to zero when no reviews exist', () => {
        const now = new Date('2024-01-15T10:00:00Z');
        const provider = new ServiceProviderEntity(
          'sp-123',
          ProviderType.PROFESSIONAL,
          0,
          0,
          new Date(),
          new Date(),
        );

        const updated = provider.withRemovedRating(5, now);

        expect(updated.averageRating).toBe(0);
        expect(updated.totalReviews).toBe(0);
      });

      it('should preserve type and id', () => {
        const provider = new ServiceProviderEntity(
          'sp-123',
          ProviderType.COMPANY,
          4.0,
          2,
          new Date(),
          new Date(),
        );

        const updated = provider.withRemovedRating(4);

        expect(updated.id).toBe('sp-123');
        expect(updated.type).toBe(ProviderType.COMPANY);
      });
    });
  });

  describe('immutability', () => {
    it('should not mutate original entity on withUpdatedRating', () => {
      const original = ServiceProviderEntity.createForProfessional('sp-123');
      const updated = original.withUpdatedRating(5);

      expect(original.averageRating).toBe(0);
      expect(original.totalReviews).toBe(0);
      expect(updated.averageRating).toBe(5);
      expect(updated.totalReviews).toBe(1);
    });

    it('should not mutate original entity on withRemovedRating', () => {
      const original = new ServiceProviderEntity(
        'sp-123',
        ProviderType.PROFESSIONAL,
        5.0,
        2,
        new Date(),
        new Date(),
      );
      const updated = original.withRemovedRating(5);

      expect(original.totalReviews).toBe(2);
      expect(updated.totalReviews).toBe(1);
    });
  });
});

