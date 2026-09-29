import { InteractionStatus, InteractionType } from '@prisma/client';
import { PrismaRequestInteractionRepository } from './prisma-request-interaction.repository';
import { createMockPrismaClient } from '../../../__mocks__/prisma.mock';

describe('PrismaRequestInteractionRepository', () => {
  describe('findMostRecentByPhone', () => {
    it('queries only FOLLOW_UP interactions created no earlier than the given cutoff, ordered newest first, without a status filter in the query (deliberate invariant, see the interface doc comment: an inbound reply must never match a non-automated interaction, and the single most recent one is checked for openness in code, not filtered out of the query)', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const cutoff = new Date('2026-09-01T00:00:00.000Z');
      await repository.findMostRecentByPhone('+5492944123456', cutoff);

      expect(prisma.requestInteraction.findFirst).toHaveBeenCalledWith({
        where: {
          metadata: { path: ['recipientPhone'], equals: '+5492944123456' },
          interactionType: InteractionType.FOLLOW_UP,
          createdAt: { gte: cutoff },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it("never matches a RESPONSE or STATUS_UPDATE interaction even if one existed - the where clause hardcodes FOLLOW_UP, it does not merely coincide with today's data", async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-09-01T00:00:00.000Z'),
      );

      const callArgs = (prisma.requestInteraction.findFirst as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.where.interactionType).toBe(InteractionType.FOLLOW_UP);
      expect(callArgs.where.interactionType).not.toBe(InteractionType.RESPONSE);
      expect(callArgs.where.interactionType).not.toBe(
        InteractionType.STATUS_UPDATE,
      );
    });

    it('returns null when there is no interaction at all for this phone within the window', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-09-01T00:00:00.000Z'),
      );

      expect(result).toBeNull();
    });

    it('matches the most recent interaction even when it belongs to a different request than an older, still-open one on the same phone ("last message wins", no reach-back between requests)', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      const mostRecentOnRequestB = {
        id: 'valid-on-b',
        requestId: 'request-b',
        status: InteractionStatus.DELIVERED,
        createdAt: new Date('2026-08-15T00:00:00.000Z'),
      };
      // An older, still-open interaction on a different request (request-a) exists
      // in the DB too, but findFirst/orderBy already returns only the newest one -
      // the repository never queries for or falls back to it.
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue(
        mostRecentOnRequestB,
      );

      const result = await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-07-01T00:00:00.000Z'),
      );

      expect(result?.id).toBe('valid-on-b');
    });

    it('returns null when the most recent interaction for the phone is already RESPONDED, even if an older interaction on another request is still open (never reaches back to it)', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      const mostRecentAlreadyResponded = {
        id: 'responded-on-b',
        requestId: 'request-b',
        status: InteractionStatus.RESPONDED,
        createdAt: new Date('2026-08-15T00:00:00.000Z'),
      };
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue(
        mostRecentAlreadyResponded,
      );

      const result = await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-07-01T00:00:00.000Z'),
      );

      expect(result).toBeNull();
    });

    it('returns null when the most recent interaction is FAILED', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue({
        id: 'failed-1',
        requestId: 'request-1',
        status: InteractionStatus.FAILED,
        createdAt: new Date('2026-08-15T00:00:00.000Z'),
      });

      const result = await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-07-01T00:00:00.000Z'),
      );

      expect(result).toBeNull();
    });

    it.each([
      InteractionStatus.PENDING,
      InteractionStatus.SENT,
      InteractionStatus.DELIVERED,
    ])('matches the most recent interaction when it is %s', async (status) => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue({
        id: 'open-1',
        requestId: 'request-1',
        status,
        createdAt: new Date('2026-08-15T00:00:00.000Z'),
      });

      const result = await repository.findMostRecentByPhone(
        '+5492944123456',
        new Date('2026-07-01T00:00:00.000Z'),
      );

      expect(result?.id).toBe('open-1');
    });
  });

  describe('findMostRecentFollowUpTimestampByPhone', () => {
    it('queries the most recent FOLLOW_UP interaction for the phone, any status, and returns its createdAt', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      const createdAt = new Date('2026-08-15T00:00:00.000Z');
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue({
        createdAt,
      });

      const result =
        await repository.findMostRecentFollowUpTimestampByPhone(
          '+5492944123456',
        );

      expect(result).toBe(createdAt);
      expect(prisma.requestInteraction.findFirst).toHaveBeenCalledWith({
        where: {
          metadata: { path: ['recipientPhone'], equals: '+5492944123456' },
          interactionType: InteractionType.FOLLOW_UP,
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
    });

    it('returns null when there is no FOLLOW_UP interaction for this phone', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const result =
        await repository.findMostRecentFollowUpTimestampByPhone(
          '+5492944123456',
        );

      expect(result).toBeNull();
    });
  });
});
