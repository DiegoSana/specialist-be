---
paths:
  - "src/**"
---

# DDD / Clean Architecture rules

Source of truth: `docs/architecture/ARCHITECTURE.md`, `docs/decisions/ADR-002-REPOSITORY-ENCAPSULATION.md`,
`docs/decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md`. Enforced by `src/__tests__/architecture.spec.ts`.
Run `npx jest src/__tests__/architecture.spec.ts` after any structural change.

## Layer responsibilities (what each layer may and may not do)

| Layer | Contains | Never contains |
|---|---|---|
| `domain/` | entities, value objects, domain services (pure), repository + query interfaces, ports, events, `*AuthContext` | Nest decorators other than none, Prisma models/records, HTTP, Twilio, cron, `PrismaService` |
| `application/` | `@Injectable` services, use cases, input DTOs (class-validator), event handlers, `@Cron` jobs | `PrismaService` (jobs are the only exception), Twilio/SMTP SDKs (use ports), request/response objects |
| `infrastructure/` | `PrismaXRepository`, `PrismaXQueryRepository`, `PrismaXMapper`, adapters (Twilio, SMTP, Mailgun), passport strategies | business rules, authorization decisions |
| `presentation/` | controllers, response DTOs (`fromEntity` static factories), presentation guards | business logic, persistence, try/catch that swallows Nest exceptions |

## Cross-context communication

- Import from another context ONLY: `application/services/*` (its public API), `domain/entities/*`
  types, `domain/events/*` (to subscribe), and `shared/**`.
- NEVER import another context's `domain/repositories/*`, `domain/queries/*`, `infrastructure/**`.
- Modules export only services (+ `JwtStrategy`/`JwtAuthGuard` from Identity). Never export
  `*_REPOSITORY` / `*_QUERY_REPOSITORY` tokens.
- Circular module deps are resolved with `forwardRef(() => XModule)` in `imports` and
  `@Inject(forwardRef(() => XService))` in constructors. Prefer removing the cycle if a service
  only needs data another context already emits as an event.
- If a context needs data from another context that is not exposed, add a public method to that
  context's service (see the table "Services available for cross-context communication" in
  ARCHITECTURE.md) and keep the method returning domain entities or plain read-model types.

## ServiceProvider abstraction (ADR-004)

`ServiceProvider { id, type: PROFESSIONAL | COMPANY, averageRating, totalReviews }` is the
polymorphic parent of `Professional` and `Company`. Everything that relates to "a provider"
(`Request.providerId`, `RequestInterest.serviceProviderId`, `Review.serviceProviderId`, event
payloads `serviceProviderId` + `providerUserId` + `providerType` + `providerName`) points to
`ServiceProvider.id`. Fields named `professionalId` are deprecated back-compat only; do not add
new ones. Rating and review count are owned by `ServiceProvider`, never by Professional/Company.

## Composition over inheritance (ADR-001)

`Professional` / `Company` / `Client` are NOT subclasses of `User`; they reference `userId`.
`User.status` (`PENDING|ACTIVE|SUSPENDED|BANNED`) is independent from
`ProfessionalStatus`/`CompanyStatus` (`PENDING_VERIFICATION|ACTIVE|VERIFIED|INACTIVE|REJECTED|SUSPENDED`).
Only one provider profile (Professional XOR Company) can be operable at a time; that rule lives in
`src/profiles/domain/services/profile-activation.policy.ts`.

## Adding a new bounded context

Use the `new-bounded-context` skill. Also add the context to `CONTEXTS` in
`src/__tests__/architecture.spec.ts` so the fitness functions cover it, and register the module in
`src/app.module.ts`.

## Domain entities

- Immutable: `public readonly` fields, changes return a new instance (`withX()`, `approve()`,
  `markAsSent()`); static factories for creation (`createPending`, `createLocal`, `createForUser`).
- Rich: state predicates (`isPending()`, `canOperate()`), invariants, and authorization
  (`canXxxBy(ctx)`) live here. No `any`, no Prisma record types in constructors.
- Enums from `@prisma/client` (`RequestStatus`, `ProviderType`, ...) are allowed in the domain;
  Prisma model types (`Prisma.RequestGetPayload`, `User` model) are not.
