import * as request from 'supertest';
import {
  TestContext,
  createTestApp,
  closeTestApp,
  cleanDatabase,
  createTestUser,
  createTestClient,
  createTestProfessional,
  createTestCompany,
  getOrCreateTrade,
  authHeader,
} from './test-setup';

describe('Requests & Interest (e2e)', () => {
  let ctx: TestContext;
  let trade: { id: string; name: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    trade = await getOrCreateTrade(ctx.prisma, 'Plomería');
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.prisma);
    trade = await getOrCreateTrade(ctx.prisma, 'Plomería');
  });

  describe('POST /api/requests - Create request', () => {
    it('should create a public request (job board)', async () => {
      const client = await createTestClient(ctx, { name: 'Test Client' });

      const createDto = {
        title: 'Necesito plomero urgente',
        description: 'Tengo una fuga de agua en la cocina',
        tradeId: trade.id,
        city: 'Bariloche',
        zone: 'Centro',
        isPublic: true,
      };

      const response = await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(client.token))
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        title: createDto.title,
        description: createDto.description,
        city: createDto.city,
        isPublic: true,
        status: 'PENDING_VERIFICATION',
      });
      expect(response.body.id).toBeDefined();
    });

    it('should create a direct request to a professional', async () => {
      const client = await createTestClient(ctx, { name: 'Direct Client' });
      const professional = await createTestProfessional(ctx, {
        name: 'Target Professional',
        tradeId: trade.id,
      });

      const createDto = {
        title: 'Trabajo directo',
        description: 'Necesito ayuda con tuberías',
        professionalId: professional.professionalId,
        city: 'Bariloche',
        isPublic: false,
      };

      const response = await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(client.token))
        .send(createDto)
        .expect(201);

      expect(response.body.isPublic).toBe(false);
      expect(response.body.providerId).toBe(professional.serviceProviderId);
    });

    it('should require client profile to create request', async () => {
      const user = await createTestUser(ctx);

      const createDto = {
        title: 'Test Request',
        description: 'Test description',
        tradeId: trade.id,
        city: 'Bariloche',
        isPublic: true,
      };

      await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(user.token))
        .send(createDto)
        .expect(403);
    });
  });

  describe('GET /api/requests/available - Job board for providers', () => {
    it('should return public requests for a professional', async () => {
      const client = await createTestClient(ctx, { email: 'client@test.com' });
      const professional = await createTestProfessional(ctx, {
        email: 'pro@test.com',
        tradeId: trade.id,
      });

      // Create a public request
      await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(client.token))
        .send({
          title: 'Public Job',
          description: 'Available work',
          tradeId: trade.id,
          city: 'Bariloche',
          isPublic: true,
        })
        .expect(201);

      const response = await request(ctx.app.getHttpServer())
        .get('/api/requests/available')
        .set(...authHeader(professional.token))
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].isPublic).toBe(true);
    });

    it('should return public requests for a company', async () => {
      const client = await createTestClient(ctx, { email: 'client2@test.com' });
      const company = await createTestCompany(ctx, {
        email: 'company@test.com',
        companyName: 'Test Company',
        tradeId: trade.id,
        status: 'ACTIVE',
      });

      // Create a public request
      await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(client.token))
        .send({
          title: 'Company Job',
          description: 'Available for companies',
          tradeId: trade.id,
          city: 'Bariloche',
          isPublic: true,
        })
        .expect(201);

      const response = await request(ctx.app.getHttpServer())
        .get('/api/requests/available')
        .set(...authHeader(company.token))
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/requests/:id/interest - Express interest', () => {
    let clientToken: string;
    let requestId: string;

    beforeEach(async () => {
      const client = await createTestClient(ctx, { email: 'interest-client@test.com' });
      clientToken = client.token;

      // Create a public request
      const response = await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(clientToken))
        .send({
          title: 'Job for Interest',
          description: 'Testing interest expression',
          tradeId: trade.id,
          city: 'Bariloche',
          isPublic: true,
        });

      requestId = response.body.id;
    });

    it('should allow professional to express interest in public request', async () => {
      const professional = await createTestProfessional(ctx, {
        email: 'interested-pro@test.com',
        tradeId: trade.id,
      });

      const response = await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(professional.token))
        .send({ message: 'Estoy interesado en este trabajo' })
        .expect(201);

      expect(response.body.serviceProviderId).toBe(professional.serviceProviderId);
      expect(response.body.message).toBe('Estoy interesado en este trabajo');
    });

    it('should allow company to express interest in public request', async () => {
      const company = await createTestCompany(ctx, {
        email: 'interested-company@test.com',
        companyName: 'Interested Company',
        tradeId: trade.id,
        status: 'ACTIVE',
      });

      const response = await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(company.token))
        .send({ message: 'Nuestra empresa puede ayudar' })
        .expect(201);

      expect(response.body.serviceProviderId).toBe(company.serviceProviderId);
    });

    it('should not allow duplicate interest', async () => {
      const professional = await createTestProfessional(ctx, {
        email: 'duplicate-pro@test.com',
        tradeId: trade.id,
      });

      // First interest
      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(professional.token))
        .send({ message: 'First interest' })
        .expect(201);

      // Second interest - should fail
      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(professional.token))
        .send({ message: 'Duplicate interest' })
        .expect(400);
    });

    it('should not allow client to express interest', async () => {
      const anotherClient = await createTestClient(ctx, { email: 'another-client@test.com' });

      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(anotherClient.token))
        .send({ message: 'Client trying to express interest' })
        .expect(403);
    });

    it('should not allow PENDING company to express interest', async () => {
      const pendingCompany = await createTestCompany(ctx, {
        email: 'pending-company@test.com',
        companyName: 'Pending Company',
        tradeId: trade.id,
        status: 'PENDING_VERIFICATION',
      });

      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(pendingCompany.token))
        .send({ message: 'Pending company interest' })
        .expect(403);
    });
  });

  describe('GET /api/requests/:id/interests - List interested providers', () => {
    it('should list all interested providers for request owner', async () => {
      const client = await createTestClient(ctx, { email: 'list-client@test.com' });

      // Create request
      const reqResponse = await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(client.token))
        .send({
          title: 'Job with Multiple Interests',
          description: 'Multiple providers interested',
          tradeId: trade.id,
          city: 'Bariloche',
          isPublic: true,
        });

      const requestId = reqResponse.body.id;

      // Create providers and express interest
      const professional = await createTestProfessional(ctx, {
        email: 'list-pro@test.com',
        tradeId: trade.id,
      });

      const company = await createTestCompany(ctx, {
        email: 'list-company@test.com',
        companyName: 'List Company',
        tradeId: trade.id,
        status: 'ACTIVE',
      });

      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(professional.token))
        .send({ message: 'Pro interested' });

      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(company.token))
        .send({ message: 'Company interested' });

      // Get list of interests
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/requests/${requestId}/interests`)
        .set(...authHeader(client.token))
        .expect(200);

      expect(response.body.length).toBe(2);
      
      // Should include provider type information
      const providerTypes = response.body.map((i: any) => i.providerType);
      expect(providerTypes).toContain('PROFESSIONAL');
      expect(providerTypes).toContain('COMPANY');
    });
  });

  describe('POST /api/requests/:id/assign-provider - Assign provider', () => {
    it('should allow client to assign a professional', async () => {
      const client = await createTestClient(ctx, { email: 'assign-client@test.com' });
      const professional = await createTestProfessional(ctx, {
        email: 'assign-pro@test.com',
        tradeId: trade.id,
      });

      // Create request
      const reqResponse = await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(client.token))
        .send({
          title: 'Job to Assign',
          description: 'Will be assigned',
          tradeId: trade.id,
          city: 'Bariloche',
          isPublic: true,
        });

      const requestId = reqResponse.body.id;

      // Professional expresses interest
      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(professional.token))
        .send({ message: 'I want this job' });

      // Client assigns professional
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/assign-provider`)
        .set(...authHeader(client.token))
        .send({ serviceProviderId: professional.serviceProviderId })
        .expect(200);

      expect(response.body.providerId).toBe(professional.serviceProviderId);
      expect(response.body.status).toBe('ACCEPTED');
    });

    it('should allow client to assign a company', async () => {
      const client = await createTestClient(ctx, { email: 'assign-client2@test.com' });
      const company = await createTestCompany(ctx, {
        email: 'assign-company@test.com',
        companyName: 'Assignable Company',
        tradeId: trade.id,
        status: 'ACTIVE',
      });

      // Create request
      const reqResponse = await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(client.token))
        .send({
          title: 'Job for Company',
          description: 'Company assignment test',
          tradeId: trade.id,
          city: 'Bariloche',
          isPublic: true,
        });

      const requestId = reqResponse.body.id;

      // Company expresses interest
      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(company.token))
        .send({ message: 'Our company can help' });

      // Client assigns company
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/assign-provider`)
        .set(...authHeader(client.token))
        .send({ serviceProviderId: company.serviceProviderId })
        .expect(200);

      expect(response.body.providerId).toBe(company.serviceProviderId);
    });

    it('should not allow assigning provider without prior interest', async () => {
      const client = await createTestClient(ctx, { email: 'no-interest-client@test.com' });
      const professional = await createTestProfessional(ctx, {
        email: 'no-interest-pro@test.com',
        tradeId: trade.id,
      });

      // Create request
      const reqResponse = await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(client.token))
        .send({
          title: 'Job No Interest',
          description: 'No one interested yet',
          tradeId: trade.id,
          city: 'Bariloche',
          isPublic: true,
        });

      const requestId = reqResponse.body.id;

      // Try to assign without interest - should fail
      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/assign-provider`)
        .set(...authHeader(client.token))
        .send({ serviceProviderId: professional.serviceProviderId })
        .expect(400);
    });
  });

  describe('DELETE /api/requests/:id/interest - Remove interest', () => {
    it('should allow provider to remove their interest', async () => {
      const client = await createTestClient(ctx, { email: 'remove-client@test.com' });
      const professional = await createTestProfessional(ctx, {
        email: 'remove-pro@test.com',
        tradeId: trade.id,
      });

      // Create request
      const reqResponse = await request(ctx.app.getHttpServer())
        .post('/api/requests')
        .set(...authHeader(client.token))
        .send({
          title: 'Job for Removal Test',
          description: 'Interest will be removed',
          tradeId: trade.id,
          city: 'Bariloche',
          isPublic: true,
        });

      const requestId = reqResponse.body.id;

      // Express interest
      await request(ctx.app.getHttpServer())
        .post(`/api/requests/${requestId}/interest`)
        .set(...authHeader(professional.token))
        .send({ message: 'Initial interest' });

      // Remove interest
      await request(ctx.app.getHttpServer())
        .delete(`/api/requests/${requestId}/interest`)
        .set(...authHeader(professional.token))
        .expect(200);

      // Verify interest is removed
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/requests/${requestId}/interest`)
        .set(...authHeader(professional.token))
        .expect(200);

      expect(response.body.hasExpressedInterest).toBe(false);
    });
  });
});

