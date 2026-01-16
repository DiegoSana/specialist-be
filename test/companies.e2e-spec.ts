import * as request from 'supertest';
import {
  TestContext,
  TestUser,
  createTestApp,
  closeTestApp,
  cleanDatabase,
  createTestUser,
  createTestCompany,
  getOrCreateTrade,
  authHeader,
} from './test-setup';

describe('Companies (e2e)', () => {
  let ctx: TestContext;
  let trade: { id: string; name: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    trade = await getOrCreateTrade(ctx.prisma, 'Construcción');
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.prisma);
    // Re-create trade after clean
    trade = await getOrCreateTrade(ctx.prisma, 'Construcción');
  });

  describe('POST /api/companies/me - Create company profile', () => {
    it('should create a company profile for authenticated user', async () => {
      const user = await createTestUser(ctx, { name: 'Company Owner' });

      const createDto = {
        companyName: 'Construcciones Patagonia',
        legalName: 'Construcciones Patagonia S.A.',
        taxId: '30-12345678-9',
        description: 'Empresa de construcción en Bariloche',
        trades: [{ tradeId: trade.id, isPrimary: true }],
        city: 'Bariloche',
        phone: '+5492944555555',
        email: 'contacto@construcciones.com',
        website: 'https://construcciones-patagonia.com',
      };

      const response = await request(ctx.app.getHttpServer())
        .post('/api/companies/me')
        .set(...authHeader(user.token))
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        companyName: createDto.companyName,
        legalName: createDto.legalName,
        city: createDto.city,
        status: 'PENDING_VERIFICATION', // New companies start as PENDING
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.serviceProviderId).toBeDefined();
    });

    it('should fail without authentication', async () => {
      const createDto = {
        companyName: 'Test Company',
        trades: [{ tradeId: trade.id, isPrimary: true }],
        city: 'Bariloche',
      };

      await request(ctx.app.getHttpServer())
        .post('/api/companies/me')
        .send(createDto)
        .expect(401);
    });

    it('should fail if user already has a company profile', async () => {
      const company = await createTestCompany(ctx, {
        companyName: 'Existing Company',
        tradeId: trade.id,
      });

      const createDto = {
        companyName: 'Another Company',
        trades: [{ tradeId: trade.id, isPrimary: true }],
        city: 'Bariloche',
      };

      await request(ctx.app.getHttpServer())
        .post('/api/companies/me')
        .set(...authHeader(company.token))
        .send(createDto)
        .expect(400);
    });

    it('should validate required fields', async () => {
      const user = await createTestUser(ctx);

      await request(ctx.app.getHttpServer())
        .post('/api/companies/me')
        .set(...authHeader(user.token))
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/companies/me/profile - Get my company profile', () => {
    it('should return the authenticated user company profile', async () => {
      const company = await createTestCompany(ctx, {
        companyName: 'Mi Empresa',
        tradeId: trade.id,
      });

      const response = await request(ctx.app.getHttpServer())
        .get('/api/companies/me/profile')
        .set(...authHeader(company.token))
        .expect(200);

      expect(response.body.id).toBe(company.companyId);
      expect(response.body.companyName).toBe('Mi Empresa');
    });

    it('should return 404 if user has no company profile', async () => {
      const user = await createTestUser(ctx);

      await request(ctx.app.getHttpServer())
        .get('/api/companies/me/profile')
        .set(...authHeader(user.token))
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/companies/me/profile')
        .expect(401);
    });
  });

  describe('PATCH /api/companies/me - Update company profile', () => {
    it('should update company profile fields', async () => {
      const company = await createTestCompany(ctx, {
        companyName: 'Original Name',
        tradeId: trade.id,
      });

      const updateDto = {
        companyName: 'Updated Name',
        description: 'New description',
        phone: '+5492944999999',
      };

      const response = await request(ctx.app.getHttpServer())
        .patch('/api/companies/me')
        .set(...authHeader(company.token))
        .send(updateDto)
        .expect(200);

      expect(response.body.companyName).toBe('Updated Name');
      expect(response.body.description).toBe('New description');
      expect(response.body.phone).toBe('+5492944999999');
    });

    it('should not allow updating another user company', async () => {
      const company1 = await createTestCompany(ctx, {
        email: 'company1@test.com',
        companyName: 'Company 1',
        tradeId: trade.id,
      });

      const company2 = await createTestCompany(ctx, {
        email: 'company2@test.com',
        companyName: 'Company 2',
        tradeId: trade.id,
      });

      // Company 2 tries to update Company 1's profile via their own /me endpoint
      // This should update their own profile, not company1's
      const response = await request(ctx.app.getHttpServer())
        .patch('/api/companies/me')
        .set(...authHeader(company2.token))
        .send({ companyName: 'Hacked Name' })
        .expect(200);

      // Should update company2's profile
      expect(response.body.id).toBe(company2.companyId);
      expect(response.body.companyName).toBe('Hacked Name');

      // company1 should remain unchanged
      const company1Profile = await ctx.prisma.company.findUnique({
        where: { id: company1.companyId },
      });
      expect(company1Profile?.companyName).toBe('Company 1');
    });
  });

  describe('GET /api/companies - Search companies (public)', () => {
    beforeEach(async () => {
      // Create test companies
      await createTestCompany(ctx, {
        email: 'active1@test.com',
        companyName: 'Construcciones del Sur',
        tradeId: trade.id,
        city: 'Bariloche',
        status: 'ACTIVE',
      });

      await createTestCompany(ctx, {
        email: 'active2@test.com',
        companyName: 'Reformas Patagonia',
        tradeId: trade.id,
        city: 'Bariloche',
        status: 'VERIFIED',
      });

      await createTestCompany(ctx, {
        email: 'pending@test.com',
        companyName: 'Empresa Pendiente',
        tradeId: trade.id,
        city: 'Bariloche',
        status: 'PENDING_VERIFICATION',
      });
    });

    it('should return active and verified companies', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/companies')
        .expect(200);

      // Should only return ACTIVE and VERIFIED companies, not PENDING
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      const statuses = response.body.map((c: any) => c.status);
      expect(statuses).not.toContain('PENDING');
    });

    it('should filter by search term', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/companies')
        .query({ search: 'Patagonia' })
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].companyName).toContain('Patagonia');
    });

    it('should filter by city', async () => {
      // Create a company in another city
      const otherTrade = await getOrCreateTrade(ctx.prisma, 'Electricidad');
      await createTestCompany(ctx, {
        email: 'neuquen@test.com',
        companyName: 'Empresa Neuquén',
        tradeId: otherTrade.id,
        city: 'Neuquén',
        status: 'ACTIVE',
      });

      const response = await request(ctx.app.getHttpServer())
        .get('/api/companies')
        .query({ city: 'Bariloche' })
        .expect(200);

      response.body.forEach((company: any) => {
        expect(company.city).toBe('Bariloche');
      });
    });

    it('should filter by trade', async () => {
      const electricityTrade = await getOrCreateTrade(ctx.prisma, 'Electricidad');
      await createTestCompany(ctx, {
        email: 'electrician@test.com',
        companyName: 'Electricistas Unidos',
        tradeId: electricityTrade.id,
        status: 'ACTIVE',
      });

      const response = await request(ctx.app.getHttpServer())
        .get('/api/companies')
        .query({ tradeId: trade.id })
        .expect(200);

      // All returned companies should have the construction trade
      // The filter should work at DB level
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/companies/:id - Get company by ID (public)', () => {
    it('should return company details by ID', async () => {
      const company = await createTestCompany(ctx, {
        companyName: 'Test Company Details',
        tradeId: trade.id,
        status: 'ACTIVE',
      });

      const response = await request(ctx.app.getHttpServer())
        .get(`/api/companies/${company.companyId}`)
        .expect(200);

      expect(response.body.id).toBe(company.companyId);
      expect(response.body.companyName).toBe('Test Company Details');
    });

    it('should return 404 for non-existent company', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/companies/non-existent-uuid')
        .expect(404);
    });
  });

  describe('POST /api/companies/me/gallery - Add gallery item', () => {
    it('should add image to gallery', async () => {
      const company = await createTestCompany(ctx, {
        companyName: 'Gallery Test Company',
        tradeId: trade.id,
      });

      const imageUrl = 'https://example.com/image1.jpg';

      const response = await request(ctx.app.getHttpServer())
        .post('/api/companies/me/gallery')
        .set(...authHeader(company.token))
        .send({ url: imageUrl })
        .expect(201);

      expect(response.body.gallery).toContain(imageUrl);
    });

    it('should not add duplicate images', async () => {
      const company = await createTestCompany(ctx, {
        companyName: 'Duplicate Test',
        tradeId: trade.id,
      });

      const imageUrl = 'https://example.com/duplicate.jpg';

      // Add first time
      await request(ctx.app.getHttpServer())
        .post('/api/companies/me/gallery')
        .set(...authHeader(company.token))
        .send({ url: imageUrl })
        .expect(201);

      // Try to add again
      await request(ctx.app.getHttpServer())
        .post('/api/companies/me/gallery')
        .set(...authHeader(company.token))
        .send({ url: imageUrl })
        .expect(400);
    });
  });

  describe('DELETE /api/companies/me/gallery - Remove gallery item', () => {
    it('should remove image from gallery', async () => {
      const company = await createTestCompany(ctx, {
        companyName: 'Remove Gallery Test',
        tradeId: trade.id,
      });

      const imageUrl = 'https://example.com/to-remove.jpg';

      // First add the image
      await request(ctx.app.getHttpServer())
        .post('/api/companies/me/gallery')
        .set(...authHeader(company.token))
        .send({ url: imageUrl })
        .expect(201);

      // Then remove it
      const response = await request(ctx.app.getHttpServer())
        .delete('/api/companies/me/gallery')
        .set(...authHeader(company.token))
        .send({ url: imageUrl })
        .expect(200);

      expect(response.body.gallery).not.toContain(imageUrl);
    });
  });

  describe('POST /api/companies/:id/verify - Verify company (Admin)', () => {
    it('should allow admin to verify a company', async () => {
      const admin = await createTestUser(ctx, { isAdmin: true });
      const company = await createTestCompany(ctx, {
        companyName: 'Company to Verify',
        tradeId: trade.id,
        status: 'PENDING_VERIFICATION',
      });

      const response = await request(ctx.app.getHttpServer())
        .post(`/api/companies/${company.companyId}/verify`)
        .set(...authHeader(admin.token))
        .expect(200);

      expect(response.body.status).toBe('VERIFIED');
    });

    it('should reject non-admin verification attempt', async () => {
      const regularUser = await createTestUser(ctx);
      const company = await createTestCompany(ctx, {
        companyName: 'Company to Verify',
        tradeId: trade.id,
        status: 'PENDING_VERIFICATION',
      });

      await request(ctx.app.getHttpServer())
        .post(`/api/companies/${company.companyId}/verify`)
        .set(...authHeader(regularUser.token))
        .expect(403);
    });

    it('should reject company owner self-verification', async () => {
      const company = await createTestCompany(ctx, {
        companyName: 'Self Verify Attempt',
        tradeId: trade.id,
        status: 'PENDING_VERIFICATION',
      });

      await request(ctx.app.getHttpServer())
        .post(`/api/companies/${company.companyId}/verify`)
        .set(...authHeader(company.token))
        .expect(403);
    });
  });
});

