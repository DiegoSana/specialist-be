import { PrismaRequestRepository } from './prisma-request.repository';
import { createMockPrismaClient } from '../../../__mocks__/prisma.mock';

describe('PrismaRequestRepository.deleteByTitlePrefix', () => {
  it('deletes every Request whose title starts with the given prefix and returns the count', async () => {
    const prisma = createMockPrismaClient();
    const repository = new PrismaRequestRepository(prisma as any);
    (prisma.request.deleteMany as jest.Mock).mockResolvedValue({ count: 4 });

    const result = await repository.deleteByTitlePrefix('[E2E]');

    expect(prisma.request.deleteMany).toHaveBeenCalledWith({
      where: { title: { startsWith: '[E2E]' } },
    });
    expect(result).toBe(4);
  });

  it('returns 0 when nothing matches the prefix', async () => {
    const prisma = createMockPrismaClient();
    const repository = new PrismaRequestRepository(prisma as any);
    (prisma.request.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    const result = await repository.deleteByTitlePrefix('[NOPE]');

    expect(result).toBe(0);
  });
});
