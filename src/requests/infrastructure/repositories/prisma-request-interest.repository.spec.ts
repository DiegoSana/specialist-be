import { RequestInterestStatus, ProviderType } from '@prisma/client';
import { PrismaRequestInterestRepository } from './prisma-request-interest.repository';
import { createMockPrismaClient } from '../../../__mocks__/prisma.mock';

describe('PrismaRequestInterestRepository', () => {
  describe('mapToDomain (via findByRequestId)', () => {
    it("sets provider.id to the Professional's own id, not the ServiceProvider id (serviceProviderId lives separately on the entity) — a client-facing consumer like GET /professionals/:id must be able to look the provider up by provider.id directly", async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInterestRepository(prisma as any);

      (prisma.requestInterest.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'interest-1',
          requestId: 'request-1',
          serviceProviderId: 'sp-own-id-professional',
          message: null,
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
          status: RequestInterestStatus.INTERESTED,
          serviceProvider: {
            id: 'sp-own-id-professional',
            type: ProviderType.PROFESSIONAL,
            averageRating: 4.5,
            totalReviews: 10,
            professional: {
              id: 'professional-own-id',
              profileImage: null,
              user: {
                firstName: 'Fernando',
                lastName: 'Gómez',
                profilePictureUrl: null,
                phone: '+5492944000000',
              },
            },
          },
        },
      ]);

      const [interest] = await repository.findByRequestId('request-1');

      expect(interest.serviceProviderId).toBe('sp-own-id-professional');
      expect(interest.provider?.id).toBe('professional-own-id');
      expect(interest.provider?.id).not.toBe('sp-own-id-professional');
    });

    it("sets provider.id to the Company's own id, not the ServiceProvider id", async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInterestRepository(prisma as any);

      (prisma.requestInterest.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'interest-2',
          requestId: 'request-1',
          serviceProviderId: 'sp-own-id-company',
          message: null,
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
          status: RequestInterestStatus.INTERESTED,
          serviceProvider: {
            id: 'sp-own-id-company',
            type: ProviderType.COMPANY,
            averageRating: 4.8,
            totalReviews: 20,
            company: {
              id: 'company-own-id',
              companyName: 'Plomeria SRL',
              profileImage: null,
              user: { phone: '+5492944000001' },
            },
          },
        },
      ]);

      const [interest] = await repository.findByRequestId('request-1');

      expect(interest.serviceProviderId).toBe('sp-own-id-company');
      expect(interest.provider?.id).toBe('company-own-id');
      expect(interest.provider?.id).not.toBe('sp-own-id-company');
    });
  });
});
