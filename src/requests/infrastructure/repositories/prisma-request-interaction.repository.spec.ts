import { InteractionStatus, InteractionType } from '@prisma/client';
import { PrismaRequestInteractionRepository } from './prisma-request-interaction.repository';
import { createMockPrismaClient } from '../../../__mocks__/prisma.mock';

describe('PrismaRequestInteractionRepository', () => {
  describe('findMostRecentByPhone', () => {
    it('queries only FOLLOW_UP interactions created no earlier than the given cutoff (deliberate invariant, see the interface doc comment: an inbound reply must never match a non-automated interaction)', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findMany as jest.Mock).mockResolvedValue([]);

      const cutoff = new Date('2026-09-01T00:00:00.000Z');
      await repository.findMostRecentByPhone('+5492944123456', cutoff);

      expect(prisma.requestInteraction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            interactionType: InteractionType.FOLLOW_UP,
            createdAt: { gte: cutoff },
            status: {
              in: [
                InteractionStatus.PENDING,
                InteractionStatus.SENT,
                InteractionStatus.DELIVERED,
              ],
            },
          }),
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it("never matches a RESPONSE or STATUS_UPDATE interaction even if one existed - the where clause hardcodes FOLLOW_UP, it does not merely coincide with today's data", async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-09-01T00:00:00.000Z'),
      );

      const callArgs = (prisma.requestInteraction.findMany as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.where.interactionType).toBe(InteractionType.FOLLOW_UP);
      expect(callArgs.where.interactionType).not.toBe(InteractionType.RESPONSE);
      expect(callArgs.where.interactionType).not.toBe(
        InteractionType.STATUS_UPDATE,
      );
    });

    it('returns null when there are no status-filtered candidates at all', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-09-01T00:00:00.000Z'),
      );

      expect(result).toBeNull();
      expect(prisma.requestInteraction.count).not.toHaveBeenCalled();
    });

    it('returns the only candidate when it has no newer interaction on its own request (not superseded)', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      const candidate = {
        id: 'interaction-1',
        requestId: 'request-1',
        status: InteractionStatus.SENT,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      };
      (prisma.requestInteraction.findMany as jest.Mock).mockResolvedValue([
        candidate,
      ]);
      (prisma.requestInteraction.count as jest.Mock).mockResolvedValue(0);

      const result = await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-07-01T00:00:00.000Z'),
      );

      expect(result?.id).toBe('interaction-1');
      expect(prisma.requestInteraction.count).toHaveBeenCalledWith({
        where: {
          requestId: 'request-1',
          createdAt: { gt: candidate.createdAt },
        },
      });
    });

    it('skips a candidate superseded by a newer interaction on the same request (any status/type) and falls through to the next candidate', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      // Newest first, as returned by the orderBy: createdAt desc query.
      const staleOnRequestA = {
        id: 'stale-on-a',
        requestId: 'request-a',
        status: InteractionStatus.SENT,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      };
      const validOnRequestB = {
        id: 'valid-on-b',
        requestId: 'request-b',
        status: InteractionStatus.DELIVERED,
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
      };
      (prisma.requestInteraction.findMany as jest.Mock).mockResolvedValue([
        staleOnRequestA,
        validOnRequestB,
      ]);
      (prisma.requestInteraction.count as jest.Mock).mockImplementation(
        ({ where }: any) =>
          Promise.resolve(where.requestId === 'request-a' ? 1 : 0),
      );

      const result = await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-07-01T00:00:00.000Z'),
      );

      expect(result?.id).toBe('valid-on-b');
      expect(prisma.requestInteraction.count).toHaveBeenCalledTimes(2);
    });

    it('returns null when every status-filtered candidate is superseded', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      const staleCandidate = {
        id: 'stale-1',
        requestId: 'request-1',
        status: InteractionStatus.SENT,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      };
      (prisma.requestInteraction.findMany as jest.Mock).mockResolvedValue([
        staleCandidate,
      ]);
      (prisma.requestInteraction.count as jest.Mock).mockResolvedValue(1);

      const result = await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-07-01T00:00:00.000Z'),
      );

      expect(result).toBeNull();
    });
  });
});
