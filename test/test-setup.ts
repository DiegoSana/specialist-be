import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

/**
 * E2E Test Setup Utilities
 *
 * Provides a real NestJS application instance connected to a test database.
 * Make sure to set DATABASE_URL to a test database in your .env.test file.
 */

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  jwtService: JwtService;
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
  isAdmin?: boolean;
}

/**
 * Creates a fully configured NestJS application for E2E testing
 */
export async function createTestApp(): Promise<TestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Configure app the same way as main.ts
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const prisma = app.get<PrismaService>(PrismaService);
  const jwtService = app.get<JwtService>(JwtService);

  return { app, prisma, jwtService };
}

/**
 * Closes the application and cleans up resources
 */
export async function closeTestApp(ctx: TestContext): Promise<void> {
  await ctx.app.close();
}

/**
 * Cleans all data from the test database
 * Call this between tests or in beforeEach
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Delete in order respecting foreign key constraints
  await prisma.$transaction([
    prisma.notificationDelivery.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.notificationPreferences.deleteMany(),
    prisma.inAppNotification.deleteMany(),
    prisma.review.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.requestInterest.deleteMany(),
    prisma.request.deleteMany(),
    prisma.professionalTrade.deleteMany(),
    prisma.professional.deleteMany(),
    prisma.companyTrade.deleteMany(),
    prisma.company.deleteMany(),
    prisma.serviceProvider.deleteMany(),
    prisma.client.deleteMany(),
    prisma.user.deleteMany(),
    // Keep trades - they're reference data
    // prisma.trade.deleteMany(),
  ]);
}

/**
 * Creates a test user and returns authentication token
 */
export async function createTestUser(
  ctx: TestContext,
  options: {
    email?: string;
    name?: string;
    isAdmin?: boolean;
  } = {},
): Promise<TestUser> {
  const email = options.email || `test-${Date.now()}@example.com`;
  const name = options.name || 'Test User';
  const isAdmin = options.isAdmin || false;
  const [firstName, ...lastNameParts] = name.split(' ');
  const lastName = lastNameParts.join(' ') || 'User';

  const user = await ctx.prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      password: '$2a$10$K8G5qjB8Z1bQZ1bQZ1bQZ.', // dummy hash
      status: 'ACTIVE',
      authProvider: 'LOCAL',
      isAdmin,
    },
  });

  const token = ctx.jwtService.sign({
    sub: user.id,
    email: user.email,
    isAdmin,
    hasClientProfile: false,
    hasProfessionalProfile: false,
  });

  return {
    id: user.id,
    email: user.email,
    token,
    isAdmin,
  };
}

/**
 * Creates a test user with a professional profile
 */
export async function createTestProfessional(
  ctx: TestContext,
  options: {
    email?: string;
    name?: string;
    tradeId: string;
    city?: string;
  },
): Promise<TestUser & { professionalId: string; serviceProviderId: string }> {
  const user = await createTestUser(ctx, { email: options.email, name: options.name });

  // Create service provider first
  const serviceProvider = await ctx.prisma.serviceProvider.create({
    data: {
      type: 'PROFESSIONAL',
      averageRating: 0,
      totalReviews: 0,
    },
  });

  // Create professional profile
  const professional = await ctx.prisma.professional.create({
    data: {
      userId: user.id,
      serviceProviderId: serviceProvider.id,
      description: options.name || 'Test Professional',
      city: options.city || 'Bariloche',
      status: 'ACTIVE',
      experienceYears: 5,
      trades: {
        create: {
          tradeId: options.tradeId,
          isPrimary: true,
        },
      },
    },
  });

  // Update token with professional profile flag
  const token = ctx.jwtService.sign({
    sub: user.id,
    email: user.email,
    isAdmin: false,
    hasClientProfile: false,
    hasProfessionalProfile: true,
  });

  return {
    ...user,
    token,
    professionalId: professional.id,
    serviceProviderId: serviceProvider.id,
  };
}

/**
 * Creates a test user with a company profile
 */
export async function createTestCompany(
  ctx: TestContext,
  options: {
    email?: string;
    companyName: string;
    tradeId: string;
    city?: string;
    status?: 'PENDING_VERIFICATION' | 'ACTIVE' | 'VERIFIED' | 'INACTIVE' | 'REJECTED' | 'SUSPENDED';
  },
): Promise<TestUser & { companyId: string; serviceProviderId: string }> {
  const user = await createTestUser(ctx, { email: options.email, name: options.companyName });

  // Create service provider first
  const serviceProvider = await ctx.prisma.serviceProvider.create({
    data: {
      type: 'COMPANY',
      averageRating: 0,
      totalReviews: 0,
    },
  });

  // Create company profile
  const company = await ctx.prisma.company.create({
    data: {
      userId: user.id,
      serviceProviderId: serviceProvider.id,
      companyName: options.companyName,
      city: options.city || 'Bariloche',
      status: options.status || 'ACTIVE',
      trades: {
        create: {
          tradeId: options.tradeId,
          isPrimary: true,
        },
      },
    },
  });

  // Update token with company profile flag
  const token = ctx.jwtService.sign({
    sub: user.id,
    email: user.email,
    isAdmin: false,
    hasClientProfile: false,
    hasProfessionalProfile: false,
    hasCompanyProfile: true,
  });

  return {
    ...user,
    token,
    companyId: company.id,
    serviceProviderId: serviceProvider.id,
  };
}

/**
 * Creates a test user with a client profile
 */
export async function createTestClient(
  ctx: TestContext,
  options: {
    email?: string;
    name?: string;
  } = {},
): Promise<TestUser & { clientId: string }> {
  const user = await createTestUser(ctx, { email: options.email, name: options.name });

  // Create client profile
  const client = await ctx.prisma.client.create({
    data: {
      userId: user.id,
    },
  });

  // Update token with client profile flag
  const token = ctx.jwtService.sign({
    sub: user.id,
    email: user.email,
    isAdmin: false,
    hasClientProfile: true,
    hasProfessionalProfile: false,
  });

  return {
    ...user,
    token,
    clientId: client.id,
  };
}

/**
 * Gets or creates a test trade
 */
export async function getOrCreateTrade(
  prisma: PrismaService,
  name: string = 'Plomería',
): Promise<{ id: string; name: string }> {
  let trade = await prisma.trade.findFirst({ where: { name } });

  if (!trade) {
    trade = await prisma.trade.create({
      data: {
        name,
        description: `${name} services`,
      },
    });
  }

  return { id: trade.id, name: trade.name };
}

/**
 * Authorization helper for supertest requests
 */
export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

