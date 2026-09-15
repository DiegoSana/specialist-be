---
name: new-bounded-context
description: Scaffold a new bounded context (Nest module) in specialist-be with the four DDD layers, DI tokens, Prisma repository, mapper, service, controller, module wiring, fitness-function registration and a module CLAUDE.md. Use when asked to "create a new module/context" (e.g. payments, scheduling, messaging).
---

# new-bounded-context

Target layout for `src/<ctx>/` (mirror `src/reputation/` for a small context, `src/requests/` for a large one):

```
src/<ctx>/
  <ctx>.module.ts
  CLAUDE.md
  domain/
    entities/<x>.entity.ts            # XEntity + XAuthContext + can*By + static factory
    value-objects/                    # optional
    events/<x>-<verb>.event.ts        # optional, EVENT_NAME '<ctx>.<x>.<verb>'
    repositories/<x>.repository.ts    # interface + export const X_REPOSITORY = Symbol('XRepository')
    queries/<x>.query-repository.ts   # only if stats/admin read models are needed
    ports/                            # external capabilities (messaging, storage)
  application/
    dto/create-<x>.dto.ts
    services/<x>.service.ts (+ .spec.ts)
    handlers/                         # event subscribers (onModuleInit + eventBus.on)
    jobs/                             # @Cron, env-flagged
  infrastructure/
    mappers/<x>.prisma-mapper.ts
    repositories/prisma-<x>.repository.ts
    queries/prisma-<x>.query-repository.ts
    adapters/
  presentation/
    <x>.controller.ts
    dto/<x>-response.dto.ts
```

## Steps

1. Prisma model(s) + migration (`add-entity-field` skill covers the mechanics).
2. Domain entity with immutable fields, factory, predicates, `XAuthContext`, `canXxxBy`.
3. Repository interface + token; mapper; `PrismaXRepository implements XRepository` using `save()`.
4. Service with `@Inject(X_REPOSITORY)`, cross-context deps via services (+ `forwardRef`),
   `buildAuthContext`, `xxxForUser` methods, events after `save`.
5. Controller + response DTO; register in module `controllers`.
6. Module: `imports: [PrismaModule, forwardRef(() => IdentityModule), ...]`,
   `providers: [XService, { provide: X_REPOSITORY, useClass: PrismaXRepository }]`,
   `exports: [XService]` with the comment `// Repositories are NOT exported - use Services instead`.
7. Register in `src/app.module.ts` and add `<ctx>: 'src/<ctx>'` to `CONTEXTS` in
   `src/__tests__/architecture.spec.ts`.
8. Specs: entity spec (auth rules), service spec (mocks as plain objects), factories in
   `src/__mocks__/test-utils.ts`.
9. Write `src/<ctx>/CLAUDE.md` (copy the structure of an existing module CLAUDE.md: purpose,
   public API, entities, invariants, gotchas).
10. Docs: `docs/architecture/ARCHITECTURE.md` bounded-context list + services table, `docs/README.md`,
    `docs/API.md`, `docs/API_STRUCTURE.md`, an ADR if the context embodies a design decision.
11. Run the `arch-check` skill.
