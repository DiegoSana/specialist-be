---
paths:
  - "**/*.spec.ts"
  - "**/*.e2e-spec.ts"
  - "src/__mocks__/**"
  - "src/__tests__/**"
  - "test/**"
---

# Testing rules

Baseline: `npm test` runs 15 suites / 291 tests in ~30s and must stay green. CI (`.github/workflows/deploy.yml`)
runs `npm test` before deploying `main` to Fly.io, so a red suite blocks production.

## Unit tests (Jest, `src/**/*.spec.ts`, rootDir `src`)

- Co-locate: `x.service.spec.ts` next to `x.service.ts`, `x.entity.spec.ts` next to the entity.
- Build services with `Test.createTestingModule({ providers: [...] })` and provide plain object
  mocks for tokens: `{ provide: REQUEST_REPOSITORY, useValue: mockRequestRepository }`,
  `{ provide: EVENT_BUS, useValue: { publish: jest.fn() } }`, and cross-context services by class
  `{ provide: ProfessionalService, useValue: mockProfessionalService }`.
- Use the factories in `src/__mocks__/test-utils.ts` (`createMockUser`, `createMockProfessional`,
  `createMockRequest`, ...) with overrides instead of hand-building entities; extend the factory
  when an entity gains fields. `src/__mocks__/prisma.mock.ts` (`jest-mock-extended`) is for
  repository/mapper tests only.
- When a service depends on `ProfileActivationService`, mock `getActivationStatus` with an explicit
  `{ hasActiveClientProfile, hasActiveProviderProfile, activeServiceProviderId }`.
- Authorization: test entity `canXxxBy` for each role (admin / owner / assigned provider /
  stranger) and test the service path with `await expect(...).rejects.toThrow(ForbiddenException)`.
- Repositories are `save`-based: assert on `save` being called with an entity whose fields changed
  (`expect.objectContaining({ status: RequestStatus.ACCEPTED })`), not on `update`.
- Never hit the network or a DB in unit tests; Twilio/SMTP/Prisma are behind ports and mocked.
- Test names in English, `describe('XService') > describe('method') > it('should ...')`.

## Architecture fitness functions (`src/__tests__/architecture.spec.ts`)

Three checks: no cross-context repository imports, no `*_REPOSITORY` exports in modules,
`PrismaService` only in allowed paths. When you add a bounded context, add it to `CONTEXTS`.
When a check fails, fix the code (move the Prisma call into a repository/query repository, or
call the other context's service); do not extend the allowlist unless an ADR justifies it.

## E2E (`test/*.e2e-spec.ts`, `npm run test:e2e`)

Real Nest app over a real Postgres (`DATABASE_URL` from `.env.test`); helpers in
`test/test-setup.ts` (`createTestApp`, user + JWT factories). Clean up created rows in `afterAll`.
E2E is not part of `npm test` or CI; run it locally when changing controllers/guards.

## Manual/system test scripts

`test/scripts/whatsapp/**` (run via `npm run whatsapp:*`) exercise the follow-up system against a
running app and Twilio sandbox; they are not Jest tests.
