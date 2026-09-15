---
name: arch-check
description: Run the full definition-of-done gate for specialist-be (architecture fitness functions, unit tests, lint, build) and explain any DDD violation with the fix. Use before committing, after moving files between layers, or when asked "check the architecture" / "is this DDD-compliant".
---

# arch-check

Run these from the repo root, in this order, and stop at the first failure:

```bash
npx jest src/__tests__/architecture.spec.ts     # 1. fitness functions (fast)
npm test -- --silent                            # 2. full unit suite (expect 15 suites, 291+ tests)
npm run lint                                    # 3. eslint --fix + prettier (repo is lint-clean; expect 0 problems)
npm run build                                   # 4. nest build
```

## Interpreting fitness-function failures

- **"DDD ARCHITECTURE VIOLATION"** (cross-context repository import): a file imports
  `../../../<other>/domain/repositories/...`. Fix: inject that context's exported service instead
  (`UserService`, `ProfessionalService`, `CompanyService`, `TradeService`, `ClientService`,
  `ProfileActivationService`, `RequestService`, `RequestInterestService`, `NotificationService`, ...).
  If the service lacks the method, add a public method to it that returns entities/read models.
- **"MODULE EXPORT VIOLATION"**: a module exports a `*_REPOSITORY` token. Remove it from `exports`
  and expose a service method.
- **"PRISMA SERVICE ENCAPSULATION VIOLATION"**: `PrismaService` used outside
  `infrastructure/repositories|queries`, `application/jobs`, `health`. Fix: move the query into the
  aggregate repository (entity results) or a query repository (`domain/queries` +
  `infrastructure/queries`, plain results) and call it from the service.
- **"missing <layer>/ directory"** warnings are informational.

## Beyond the automated checks, eyeball

- Authorization: no ownership/admin checks in controllers; entity `canXxxBy` + service `xxxForUser`.
- `isFullyVerified()` / `canOperate()` used for permissions only inside `ProfileActivationService`.
- Repositories: `save()` only, no `update(id, partial)`; mapping in `infrastructure/mappers`.
- New `professionalId` fields (should be `providerId`/`serviceProviderId`).
- Events published after `save`, handlers subscribe in `onModuleInit`.
- Docs touched when API/permissions/schema changed (see `.claude/rules/08-docs-and-backlog.md`).

Report the result as: what passed, what failed with the exact violation lines, and the fix applied
or proposed.
