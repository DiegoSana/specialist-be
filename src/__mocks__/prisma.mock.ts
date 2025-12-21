/**
 * Prisma Mock for Unit Testing
 * Use this to mock the PrismaService in unit tests
 */
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const createMockPrismaClient = (): MockPrismaClient => {
  return mockDeep<PrismaClient>();
};

export const prismaMock = createMockPrismaClient();
