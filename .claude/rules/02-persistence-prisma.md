---
paths:
  - "src/**/infrastructure/**"
  - "src/**/domain/repositories/**"
  - "src/**/domain/queries/**"
  - "src/**/application/jobs/**"
  - "prisma/schema.prisma"
---

# Persistence rules (repositories, query repositories, mappers, Prisma)

Source of truth: `docs/architecture/PERSISTENCE_BOUNDARIES.md`, `docs/architecture/QUERY_REPOSITORIES.md`,
`docs/decisions/ADR-002-DDD-PERSISTENCE-BOUNDARIES.md`. Enforced by the "PrismaService Encapsulation"
fitness function in `src/__tests__/architecture.spec.ts`.

## Where PrismaService is allowed

Only in `infrastructure/repositories/`, `infrastructure/queries/`, `application/jobs/`, `src/health/`
and `src/shared/infrastructure/prisma/`. Anywhere else (services, controllers, handlers, entities)
is a violation and fails `npm test`. Even a `this.prisma.` usage without an import is flagged.

## Three kinds of persistence contracts

1. **Aggregate repository** (`domain/repositories/x.repository.ts`): collection semantics.
   `findById(id): Promise<XEntity | null>`, `findByX(...)`, `save(entity): Promise<XEntity>`.
   `save` decides create vs update (upsert) internally. NO `update(id, Partial<X>)`, NO `create(dto)`.
   Current aggregates: User, Professional, Company, Client, Trade, Request, Review, RequestInteraction,
   Notification, NotificationPreferences, InAppNotification.
2. **Association store**: explicit `add(...)` / `remove(...)` / `removeAllByX(...)` (e.g.
   `RequestInterestRepository`), or append-only `create + query` (e.g. `ContactRepository`).
3. **Query repository** (`domain/queries/x.query-repository.ts` + `infrastructure/queries/prisma-x.query-repository.ts`):
   stats and admin read models that return plain types/DTOs, not entities (`getUserStats()`,
   `findAllForAdmin({ skip, take })`). Do not put these in aggregate repositories. Existing:
   User, Professional, Company, Request.

Every interface exports its DI token beside it: `export const X_REPOSITORY = Symbol('XRepository')`.
Wire in the module: `{ provide: X_REPOSITORY, useClass: PrismaXRepository }`.

## Mappers

- One `PrismaXMapper` per aggregate in `infrastructure/mappers/x.prisma-mapper.ts` with static
  `toDomain(record)` and `toPersistence(entity)` (or `toPersistenceSave`). Repositories never build
  entities inline.
- Derived flags on `User` (`hasClientProfile`, `hasProfessionalProfile`, `hasCompanyProfile`) are
  computed from included relations; reads that need them must `include` those relations.
- Keep `include`/`select` shapes as private readonly constants in the repository (`fullInclude`).

## Schema changes

- After editing `prisma/schema.prisma`: `npx prisma migrate dev --name <snake_case>` then
  `npx prisma generate`, then update entity, mapper, repository, DTOs, response DTOs, seed and docs.
  Use the `add-entity-field` skill.
- Keep `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` in the generator (Alpine images).
- Never introduce `active` booleans on profiles; operability is derived from `status`.
- Contact data (phone, email, verification flags) lives only on `User`.
- Unique constraints that encode invariants: `Company.taxId`, `Review.requestId`,
  `RequestInterest(requestId, serviceProviderId)`, `RequestInteraction.twilioMessageSid`.

## Jobs touching Prisma

`application/jobs/` may use `PrismaService` for batch reads, but prefer repository/port methods
(e.g. `NotificationDeliveryQueue` port, `RequestInteractionRepository`). Jobs must be idempotent,
env-flagged, and log counts (scheduled/skipped/errors) instead of throwing.
