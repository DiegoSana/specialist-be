import { InteractionStatus, InteractionType } from '@prisma/client';
import { PrismaRequestInteractionRepository } from './prisma-request-interaction.repository';
import { createMockPrismaClient } from '../../../__mocks__/prisma.mock';

describe('PrismaRequestInteractionRepository', () => {
  describe('findMostRecentByPhone', () => {
    it('queries only FOLLOW_UP interactions created no earlier than the given cutoff (deliberate invariant, see the interface doc comment: an inbound reply must never match a non-automated interaction)', async () => {
      const prisma = createMockPrismaClient();
      const repository = new PrismaRequestInteractionRepository(prisma as any);
      (prisma.requestInteraction.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const cutoff = new Date('2026-09-01T00:00:00.000Z');
      await repository.findMostRecentByPhone('+5492944123456', cutoff);

      expect(prisma.requestInteraction.findFirst).toHaveBeenCalledWith(
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
        }),
      );
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
  });
});
