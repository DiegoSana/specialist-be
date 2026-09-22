#!/usr/bin/env tsx
/**
 * Generates a diverse spread of Request states for manual QA, driving everything through the
 * real HTTP API (create request, express interest, assign provider, accept a direct request,
 * PATCH status) plus the dev-only WhatsApp admin endpoints
 * (POST /admin/whatsapp/conversations/:id/trigger-followup + .../simulate-reply) to walk a
 * request through the WhatsApp-only transitions (agreement -> in progress -> finished ->
 * closed/under review) without touching Twilio or the database directly.
 *
 * Pure HTTP client: no Prisma/DATABASE_URL needed, so it's safe against ANY environment that
 * already has the seed data loaded and has WHATSAPP_PROVIDER=local + (NODE_ENV!=production OR
 * WHATSAPP_DEV_MODE_ENABLED=true) — local dev, or the Fly.io pre-launch testing deploy (see
 * docs/guides/whatsapp/README.md and fly.toml's [env] block).
 *
 * Does NOT cover EXPIRED/NO_RESPONSE/ABANDONED/auto-CLOSED, REJECTED or CANCELLED: the first four
 * are only produced by RequestExpirationJob (Sistema actor), which is disabled by default
 * (REQUEST_EXPIRATION_ENABLED) and this script deliberately never backdates a request to fake
 * elapsed time; REJECTED/CANCELLED were left out of this batch's scope on purpose (see
 * ../../../../TODO.md).
 *
 * Usage:
 *   npx tsx test/scripts/seed-data/generate-diverse-requests.ts
 *   npx tsx test/scripts/seed-data/generate-diverse-requests.ts --api-url=https://specialist-api.fly.dev/api
 *   API_URL=https://specialist-api.fly.dev/api npx tsx test/scripts/seed-data/generate-diverse-requests.ts
 *
 * Requires the seed data (`npm run db:seed`) to already exist in the target environment.
 */

const args = process.argv.slice(2);
const apiUrlArg = args.find((a) => a.startsWith('--api-url='));
const API_URL =
  apiUrlArg?.slice('--api-url='.length) ??
  process.env.API_URL ??
  'http://localhost:5000/api';

const SEED_PASSWORD = 'Test1234!';

const tokenCache = new Map<string, string>();

async function api<T = any>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new Error(
      `${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`,
    );
  }
  return json as T;
}

async function login(email: string): Promise<string> {
  const cached = tokenCache.get(email);
  if (cached) return cached;
  const { accessToken } = await api<{ accessToken: string }>(
    'POST',
    '/auth/login',
    { body: { email, password: SEED_PASSWORD } },
  );
  tokenCache.set(email, accessToken);
  return accessToken;
}

interface ProviderRef {
  id: string;
  serviceProviderId: string;
}

const providerCache = new Map<string, ProviderRef>();

// The public /providers catalog is the only response that reliably includes
// serviceProviderId for BOTH professionals and companies - ProfessionalResponseDto (used by
// GET /professionals/me/profile) omits it entirely, unlike CompanyResponseDto. Resolve it from
// there instead of assuming every "my profile" response has the same shape.
let serviceProviderIdByOwnId: Record<string, string> | null = null;

async function serviceProviderIdFor(ownId: string): Promise<string> {
  if (!serviceProviderIdByOwnId) {
    const providers = await api<{ id: string; serviceProviderId: string }[]>(
      'GET',
      '/providers',
    );
    serviceProviderIdByOwnId = Object.fromEntries(
      providers.map((p) => [p.id, p.serviceProviderId]),
    );
  }
  const serviceProviderId = serviceProviderIdByOwnId[ownId];
  if (!serviceProviderId) {
    throw new Error(
      `serviceProviderId not found in public catalog for id ${ownId}`,
    );
  }
  return serviceProviderId;
}

async function professionalMe(email: string): Promise<ProviderRef> {
  const cached = providerCache.get(email);
  if (cached) return cached;
  const token = await login(email);
  const profile = await api<{ id: string }>(
    'GET',
    '/professionals/me/profile',
    { token },
  );
  const ref = {
    id: profile.id,
    serviceProviderId: await serviceProviderIdFor(profile.id),
  };
  providerCache.set(email, ref);
  return ref;
}

async function companyMe(email: string): Promise<ProviderRef> {
  const cached = providerCache.get(email);
  if (cached) return cached;
  const token = await login(email);
  const profile = await api<{ id: string }>('GET', '/companies/me/profile', {
    token,
  });
  const ref = {
    id: profile.id,
    serviceProviderId: await serviceProviderIdFor(profile.id),
  };
  providerCache.set(email, ref);
  return ref;
}

let tradeIdByName: Record<string, string> | null = null;

async function tradeId(name: string): Promise<string> {
  if (!tradeIdByName) {
    const trades = await api<{ id: string; name: string }[]>('GET', '/trades');
    tradeIdByName = Object.fromEntries(trades.map((t) => [t.name, t.id]));
  }
  const id = tradeIdByName[name];
  if (!id) throw new Error(`Trade not found: ${name}`);
  return id;
}

async function createPublicRequest(
  clientEmail: string,
  trade: string,
  title: string,
  description: string,
): Promise<string> {
  const token = await login(clientEmail);
  const { id } = await api<{ id: string }>('POST', '/requests', {
    token,
    body: {
      isPublic: true,
      tradeId: await tradeId(trade),
      title,
      description,
    },
  });
  return id;
}

async function createDirectRequest(
  clientEmail: string,
  provider: { professionalId?: string; companyId?: string },
  title: string,
  description: string,
): Promise<string> {
  const token = await login(clientEmail);
  const { id } = await api<{ id: string }>('POST', '/requests', {
    token,
    body: {
      isPublic: false,
      ...provider,
      title,
      description,
    },
  });
  return id;
}

async function expressInterest(
  providerEmail: string,
  requestId: string,
  message: string,
): Promise<void> {
  const token = await login(providerEmail);
  await api('POST', `/requests/${requestId}/interest`, {
    token,
    body: { message },
  });
}

async function assignProvider(
  clientEmail: string,
  requestId: string,
  serviceProviderId: string,
): Promise<void> {
  const token = await login(clientEmail);
  await api('POST', `/requests/${requestId}/assign-provider`, {
    token,
    body: { serviceProviderId },
  });
}

async function patchStatus(
  actorEmail: string,
  requestId: string,
  status: string,
): Promise<void> {
  const token = await login(actorEmail);
  await api('PATCH', `/requests/${requestId}`, { token, body: { status } });
}

async function createReview(
  clientEmail: string,
  requestId: string,
  professionalId: string,
  rating: number,
  comment: string,
): Promise<void> {
  const token = await login(clientEmail);
  await api('POST', '/reviews', {
    token,
    // professionalId is required by CreateReviewDto's validation but ignored by the service
    // (it resolves the provider from the request itself) - see rule 08's "Known code/doc
    // discrepancies". Pass it anyway so validation doesn't reject the call.
    body: { professionalId, requestId, rating, comment },
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * simulate-reply publishes RequestInteractionRespondedEvent on the in-process EventBus, which
 * is fire-and-forget (see rule 05-events-jobs-notifications.md): the HTTP call returns before
 * RequestInteractionRespondedHandler finishes updating the request's status. Poll instead of
 * assuming the status already changed when simulate-reply's response comes back.
 */
async function waitForStatus(
  adminToken: string,
  requestId: string,
  expectedStatus: string,
  timeoutMs = 20000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const req = await api<{ status: string }>('GET', `/requests/${requestId}`, {
      token: adminToken,
    });
    if (req.status === expectedStatus) return;
    await sleep(300);
  }
  throw new Error(
    `Timed out waiting for request ${requestId} to reach ${expectedStatus}`,
  );
}

/** Drives CONTACT_RELEASED -> IN_PROGRESS via the WhatsApp admin dev tools (P1: "sí"). */
async function simulateAgreement(adminToken: string, requestId: string) {
  await api(
    'POST',
    `/admin/whatsapp/conversations/${requestId}/trigger-followup`,
    {
      token: adminToken,
      body: { ruleName: 'CONTACT_RELEASED_QUESTION_CLIENT_2D' },
    },
  );
  await api(
    'POST',
    `/admin/whatsapp/conversations/${requestId}/simulate-reply`,
    {
      token: adminToken,
      body: { body: 'Sí, dale, dale para adelante' },
    },
  );
  await waitForStatus(adminToken, requestId, 'IN_PROGRESS');
}

/** Drives IN_PROGRESS -> FINISHED via the WhatsApp admin dev tools (P2: "terminé"). */
async function simulateProgressDone(adminToken: string, requestId: string) {
  await api(
    'POST',
    `/admin/whatsapp/conversations/${requestId}/trigger-followup`,
    {
      token: adminToken,
      body: { ruleName: 'IN_PROGRESS_QUESTION_7D' },
    },
  );
  await api(
    'POST',
    `/admin/whatsapp/conversations/${requestId}/simulate-reply`,
    {
      token: adminToken,
      // Deliberately avoids the word "listo": DetectResponseIntentUseCase checks CONFIRMED
      // keywords (which include "listo") before COMPLETED ones (which also include "listo"),
      // so a reply containing it always resolves to CONFIRMED - a no-op for this question -
      // instead of COMPLETED, even though "listo" is in both lists. Reproduced against the
      // Fly.io deploy's local/keyword classifier (INTENT_CLASSIFIER_PROVIDER unset there).
      body: { body: 'Ya terminé el trabajo, quedó todo funcionando bien' },
    },
  );
  await waitForStatus(adminToken, requestId, 'FINISHED');
}

/** Drives FINISHED -> CLOSED via the WhatsApp admin dev tools (P3: "sí, conforme"). */
async function simulateSatisfied(adminToken: string, requestId: string) {
  await api(
    'POST',
    `/admin/whatsapp/conversations/${requestId}/trigger-followup`,
    {
      token: adminToken,
      body: { ruleName: 'FINISHED_QUESTION_0D' },
    },
  );
  await api(
    'POST',
    `/admin/whatsapp/conversations/${requestId}/simulate-reply`,
    {
      token: adminToken,
      body: { body: 'Sí, quedé muy conforme, gracias' },
    },
  );
  await waitForStatus(adminToken, requestId, 'CLOSED');
}

/** Drives FINISHED -> UNDER_REVIEW via the WhatsApp admin dev tools (P3: "no, hubo un problema"). */
async function simulateDissatisfied(adminToken: string, requestId: string) {
  await api(
    'POST',
    `/admin/whatsapp/conversations/${requestId}/trigger-followup`,
    {
      token: adminToken,
      body: { ruleName: 'FINISHED_QUESTION_0D' },
    },
  );
  await api(
    'POST',
    `/admin/whatsapp/conversations/${requestId}/simulate-reply`,
    {
      token: adminToken,
      body: { body: 'No, no quedé conforme, hubo un problema con el trabajo' },
    },
  );
  await waitForStatus(adminToken, requestId, 'UNDER_REVIEW');
}

interface Result {
  title: string;
  targetStatus: string;
  requestId?: string;
  error?: string;
}

async function run() {
  console.log(`Generating diverse test requests against ${API_URL}\n`);

  const results: Result[] = [];
  const record = async (
    title: string,
    targetStatus: string,
    fn: () => Promise<string>,
  ) => {
    try {
      const requestId = await fn();
      results.push({ title, targetStatus, requestId });
      console.log(`OK   [${targetStatus}] ${title} -> ${requestId}`);
    } catch (e: any) {
      results.push({ title, targetStatus, error: e.message });
      console.log(`FAIL [${targetStatus}] ${title} -> ${e.message}`);
    }
  };

  const adminToken = await login('admin@specialist.com');

  const plomero = await professionalMe('plomero@test.com');
  const electricista = await professionalMe('electricista@test.com');
  const gasista = await professionalMe('gasista@test.com');
  const carpintero = await professionalMe('carpintero@test.com');
  // pintor@test.com is seeded as PENDING_VERIFICATION (see prisma/seed.ts) and can't act as an
  // active provider - deliberately not used here.
  const multioficio = await professionalMe('multioficio@test.com');
  const constructora = await companyMe('constructora@test.com');
  const pinturasnorte = await companyMe('pinturasnorte@test.com');

  // 1. PUBLISHED, no interest yet.
  await record(
    'Instalación de tomas eléctricas',
    'PUBLISHED (sin interesados)',
    () =>
      createPublicRequest(
        'cliente2@test.com',
        'Electricista',
        'Instalación de tomas eléctricas',
        'Necesito instalar 4 tomas nuevas en el living y el escritorio.',
      ),
  );

  // 2. PUBLISHED with multiple interested providers - the key scenario for the new
  //    interested-specialists detail popup (TODO item 5).
  await record(
    'Reparación de cañería con pérdida',
    'PUBLISHED (2 interesados)',
    async () => {
      const id = await createPublicRequest(
        'cliente1@test.com',
        'Plomero',
        'Reparación de cañería con pérdida',
        'Hay una pérdida de agua en el baño principal, necesito que lo vean pronto.',
      );
      await expressInterest(
        'plomero@test.com',
        id,
        'Puedo pasar mañana a la mañana a revisarlo.',
      );
      await expressInterest(
        'multioficio@test.com',
        id,
        'Tengo disponibilidad esta semana, hago plomería y electricidad.',
      );
      return id;
    },
  );

  // 3. SENT, direct to a professional, awaiting response.
  await record('Cambio de tablero eléctrico', 'SENT (a especialista)', () =>
    createDirectRequest(
      'cliente3@test.com',
      { professionalId: electricista.id },
      'Cambio de tablero eléctrico',
      'El tablero es viejo y quiero modernizarlo, ¿podés pasar a cotizar?',
    ),
  );

  // 4. SENT, direct to a company, awaiting response.
  await record(
    'Presupuesto para ampliación de living',
    'SENT (a empresa)',
    () =>
      createDirectRequest(
        'cliente4@test.com',
        { companyId: constructora.id },
        'Presupuesto para ampliación de living',
        'Queremos ampliar el living unos 15m2, necesitamos presupuesto.',
      ),
  );

  // 5. CONTACT_RELEASED via the job board (client chooses among interested providers).
  await record(
    'Pintura de living y dormitorio',
    'CONTACT_RELEASED (vía bolsa)',
    async () => {
      const id = await createPublicRequest(
        'cliente2@test.com',
        'Pintor',
        'Pintura de living y dormitorio',
        'Necesito pintar el living y un dormitorio, paredes en buen estado.',
      );
      await expressInterest(
        'pinturasnorte@test.com',
        id,
        'Trabajamos con pintura de primera calidad, tenemos disponibilidad esta semana.',
      );
      await assignProvider(
        'cliente2@test.com',
        id,
        pinturasnorte.serviceProviderId,
      );
      return id;
    },
  );

  // 6. CONTACT_RELEASED via a direct request the provider accepts.
  await record(
    'Revisión de instalación de gas',
    'CONTACT_RELEASED (directo aceptado)',
    async () => {
      const id = await createDirectRequest(
        'cliente1@test.com',
        { professionalId: gasista.id },
        'Revisión de instalación de gas',
        'Quiero una revisión general de la instalación antes del invierno.',
      );
      await patchStatus('gasista@test.com', id, 'CONTACT_RELEASED');
      return id;
    },
  );

  // 7. IN_PROGRESS.
  await record('Muebles a medida para cocina', 'IN_PROGRESS', async () => {
    const id = await createDirectRequest(
      'cliente3@test.com',
      { professionalId: carpintero.id },
      'Muebles a medida para cocina',
      'Necesito muebles altos y bajos a medida para la cocina.',
    );
    await patchStatus('carpintero@test.com', id, 'CONTACT_RELEASED');
    await simulateAgreement(adminToken, id);
    return id;
  });

  // 8. FINISHED, awaiting the client's satisfaction confirmation.
  await record(
    'Pérdida de gas en la cocina',
    'FINISHED (esperando confirmación)',
    async () => {
      const id = await createPublicRequest(
        'cliente4@test.com',
        'Gasista',
        'Pérdida de gas en la cocina',
        'Sentimos olor a gas cerca de la cocina, necesitamos que lo revisen urgente.',
      );
      await expressInterest(
        'gasista@test.com',
        id,
        'Podemos revisarlo esta semana.',
      );
      await assignProvider('cliente4@test.com', id, gasista.serviceProviderId);
      await simulateAgreement(adminToken, id);
      await simulateProgressDone(adminToken, id);
      return id;
    },
  );

  // 9. CLOSED, not rated yet - regression coverage for the "Calificar" button (should show).
  await record(
    'Arreglo de cortocircuito',
    'CLOSED (sin calificar)',
    async () => {
      const id = await createDirectRequest(
        'cliente1@test.com',
        { professionalId: electricista.id },
        'Arreglo de cortocircuito',
        'Salta la térmica cada vez que uso el microondas, necesito que lo revisen.',
      );
      await patchStatus('electricista@test.com', id, 'CONTACT_RELEASED');
      await simulateAgreement(adminToken, id);
      await simulateProgressDone(adminToken, id);
      await simulateSatisfied(adminToken, id);
      return id;
    },
  );

  // 10. CLOSED, already rated - regression coverage for TODO item 2's fix (PR #21): the
  //     "Calificar" button must NOT show in the Cerrados list for this one.
  await record('Destape de cañería', 'CLOSED (ya calificado)', async () => {
    const id = await createDirectRequest(
      'cliente2@test.com',
      { professionalId: plomero.id },
      'Destape de cañería',
      'La pileta de la cocina no drena, parece un tapón.',
    );
    await patchStatus('plomero@test.com', id, 'CONTACT_RELEASED');
    await simulateAgreement(adminToken, id);
    await simulateProgressDone(adminToken, id);
    await simulateSatisfied(adminToken, id);
    await createReview(
      'cliente2@test.com',
      id,
      plomero.id,
      5,
      'Excelente trabajo, muy prolijo y puntual.',
    );
    return id;
  });

  // 11. UNDER_REVIEW - client objects to the "finished" report.
  await record('Instalación eléctrica en garaje', 'UNDER_REVIEW', async () => {
    const id = await createDirectRequest(
      'cliente3@test.com',
      { professionalId: multioficio.id },
      'Instalación eléctrica en garaje',
      'Necesito instalar 3 luces y 2 tomas en el garaje.',
    );
    await patchStatus('multioficio@test.com', id, 'CONTACT_RELEASED');
    await simulateAgreement(adminToken, id);
    await simulateProgressDone(adminToken, id);
    await simulateDissatisfied(adminToken, id);
    return id;
  });

  console.log('\nSummary:\n');
  console.log('Status'.padEnd(32), 'Title'.padEnd(38), 'Request ID / error');
  console.log('-'.repeat(110));
  for (const r of results) {
    console.log(
      r.targetStatus.padEnd(32),
      r.title.padEnd(38),
      r.requestId ?? `ERROR: ${r.error}`,
    );
  }

  const failures = results.filter((r) => r.error).length;
  if (failures > 0) {
    console.log(
      `\n${failures} of ${results.length} scenarios failed - see FAIL lines above.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} scenarios created successfully.`);
  }
}

run().catch((e) => {
  console.error('Fatal error:', e);
  process.exitCode = 1;
});
