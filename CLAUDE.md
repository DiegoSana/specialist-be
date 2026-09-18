# Specialist Backend (specialist-be)

NestJS 10 + Prisma + PostgreSQL REST API for a marketplace that connects clients with verified
service providers (Professionals and Companies) in Bariloche. Deployed on Fly.io. This repo is
the backend; sibling repos live in `/var/www/specialist/` (`specialist-fe` Next.js web,
`specialist-admin` Next.js admin portal, `specialist-shared` shared TS package).

Detailed, path-scoped rules live in `.claude/rules/`. Module-specific context lives in
`src/<context>/CLAUDE.md`. Reusable workflows live in `.claude/skills/`.

## Commands

```bash
npm run start:dev            # dev server with watch, http://localhost:5000/api (Swagger at /api/docs)
npm test                     # unit tests + architecture fitness functions (must stay green: 291 tests)
npm test -- --testPathPattern="request.service"   # single spec
npx jest src/__tests__/architecture.spec.ts        # only the DDD fitness functions
npm run lint                 # eslint --fix + prettier (singleQuote, trailingComma all); repo is lint-clean
npm run build                # nest build
npm run test:e2e             # e2e (needs a real DB, see test/test-setup.ts)
npx prisma generate          # after ANY schema.prisma change
npx prisma migrate dev --name <snake_case_name>    # new migration (dev only)
npm run prisma:studio
docker-compose -f docker-compose.dev.yml up -d     # postgres + mailpit(:8025) + app
```

Definition of done for any code change: `npm test` green (including `architecture.spec.ts`),
`npm run lint` with zero errors (the whole repo is prettier/eslint clean since 2026-09-15; keep it
that way), `npm run build` passes, docs updated when behavior/API/architecture changed.
Note that `npm run lint` runs `eslint --fix`, so it rewrites files: run it before reviewing your diff.

## Architecture in one screen

Clean Architecture + DDD. Each bounded context under `src/<context>/` has four layers:

```
domain/         entities (rich, immutable, with can*By(ctx) auth methods), value-objects, events,
                repositories/ (interfaces + DI tokens), queries/ (read-model interfaces), ports/
application/    services (use cases, orchestration, throw Nest HTTP exceptions), dto/ (input DTOs),
                handlers/ (event subscribers), jobs/ (@Cron), use-cases/
infrastructure/ repositories/ (Prisma*Repository), queries/, mappers/ (*.prisma-mapper.ts),
                adapters/, strategies/, guards/
presentation/   controllers, response dto/, presentation guards
<context>.module.ts   wires tokens -> Prisma impls; exports ONLY services
```

Bounded contexts: `identity` (users, auth, verification), `profiles` (Client, Professional,
Company, ServiceProvider, Trade, ProfileActivationService), `requests` (service requests,
interests, WhatsApp follow-up interactions), `support` (general WhatsApp support/conversation
channel, independent of any Request - see `src/support/CLAUDE.md` and
`docs/decisions/ADR-005-SUPPORT-CONVERSATIONS.md`), `reputation` (reviews + moderation),
`notifications` (in-app + email/whatsapp deliveries), `storage` (files), `admin`, `contact`,
`health`. `shared/` holds the Prisma module, in-memory EventBus, messaging (Twilio, including the
`WhatsAppMessagingPort` shared by `requests` and `support`), decorators and guards.

## Non-negotiable rules (enforced by `src/__tests__/architecture.spec.ts`)

1. Never import another context's `domain/repositories/*` or `domain/queries/*`. Cross-context
   communication goes through the other context's exported **Service** (use `forwardRef` for
   cycles). Modules must never export `*_REPOSITORY` tokens.
2. `PrismaService` may only be injected in `infrastructure/repositories/`, `infrastructure/queries/`,
   `application/jobs/`, `health/` and the Prisma module itself. Services and controllers never
   touch Prisma.
3. Aggregate repositories expose `findBy*()` + `save(entity)`. No `update(id, Partial<T>)`.
   Changes are made through entity methods (`withX()`, `approve()`, ...) and then `save`.
4. Authorization rules live in domain entities as `canXxxBy(ctx: XAuthContext)`. Services build
   the context and throw `ForbiddenException`. Controllers only extract `@CurrentUser()` and
   delegate. "Active profile" flags come exclusively from `ProfileActivationService`
   (`src/profiles/application/services/profile-activation.service.ts`); never call
   `user.isFullyVerified()` or `profile.canOperate()` from other contexts for permission checks.
5. Prisma types/records never leak into `domain/`. Mapping is done in `infrastructure/mappers/`
   (`toDomain` / `toPersistence`). Enums from `@prisma/client` are the exception and are used
   directly in domain code.

## Key docs (read before touching the related area)

- `docs/architecture/ARCHITECTURE.md` bounded contexts, conventions
- `docs/architecture/PERSISTENCE_BOUNDARIES.md`, `docs/architecture/QUERY_REPOSITORIES.md`
- `docs/architecture/AUTHORIZATION_PATTERN.md`, `docs/architecture/PROFILE_ACTIVATION_ORCHESTRATION.md`
- `docs/guides/PERMISSIONS_BY_ROLE.md` who can do what per endpoint
- `docs/architecture/COMPANY_PROFILES.md`, `docs/decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md`
- `docs/guides/MIGRATION_GUIDE.md` DB migration workflow, `docs/guides/ENVIRONMENT_VARIABLES.md`
- `docs/guides/whatsapp/README.md` WhatsApp follow-up system
- `docs/API.md`, `docs/API_STRUCTURE.md` endpoints; `TODO.md` current backlog and session log

## Conventions

- Naming: `XEntity`, `CreateXDto`, `XService`, `XRepository` (interface) / `PrismaXRepository`
  (impl), `XQueryRepository` / `PrismaXQueryRepository`, `PrismaXMapper`, `XController`, `XModule`.
- DI tokens: `export const X_REPOSITORY = Symbol('XRepository')` next to the interface.
- Errors: NestJS built-ins only (`NotFoundException`, `BadRequestException`,
  `ForbiddenException`, `UnauthorizedException`, `ConflictException`).
- IDs: `randomUUID()` generated in the service/entity factory, not by the DB.
- Domain events: class with `static readonly EVENT_NAME = '<context>.<aggregate>.<past_tense>'`,
  published via `EVENT_BUS` from services after `save`; handlers subscribe in `onModuleInit`.
- Code, identifiers and comments in English. User-facing strings (notifications, WhatsApp
  templates, error messages shown to end users) are in Spanish (es-AR, "vos" form).
- Commits: Conventional Commits with context scope, e.g. `feat(requests): ...`,
  `refactor(profiles): ...`, `docs: ...`, `test: ...`. Branches `feat/<topic>`, `refactor/<topic>`.
- `tsconfig` is NOT strict (`strictNullChecks: false`). Do not rely on the compiler to catch
  null issues; be explicit with `| null` in entity constructors and check for `null` returns.

## Gotchas

- Two `JwtAuthGuard` files exist. Controllers must import
  `src/identity/infrastructure/guards/jwt-auth.guard.ts` (the one exported by `IdentityModule`).
  `@Public()` from `shared/presentation/decorators` bypasses it.
- `RequestEntity.professionalId` is a deprecated getter for `providerId` (a `ServiceProvider` id,
  not a Professional id). New code uses `providerId` / `serviceProviderId`.
- Profile contact data (phone/email/whatsapp) lives ONLY on `User` since migration
  `20260206000000`. Profiles have no `active` flag; `canOperate()` is `status in (ACTIVE, VERIFIED)`.
- Jobs are `@Cron` in `application/jobs/` and are feature-flagged by env
  (`WHATSAPP_FOLLOWUP_ENABLED`, `NOTIFICATIONS_DISPATCH_ENABLED`). Don't fire real Twilio/SMTP
  in tests; ports are mocked.
- Two files are both named ADR-002 (`REPOSITORY-ENCAPSULATION` and `DDD-PERSISTENCE-BOUNDARIES`).
  Next ADR number is 005.
- `.env` exists locally and is gitignored; never print secret values. Env var names are listed in
  `docs/guides/ENVIRONMENT_VARIABLES.md`. JWT expiry is `JWT_EXPIRES_IN` (`JWT_EXPIRATION` is a
  legacy fallback).
