---
paths:
  - "src/**/domain/entities/**"
  - "src/**/application/services/**"
  - "src/**/presentation/**"
---

# Authorization pattern (hybrid Service + Domain)

Source of truth: `docs/architecture/AUTHORIZATION_PATTERN.md`,
`docs/architecture/PROFILE_ACTIVATION_ORCHESTRATION.md`, `docs/guides/PERMISSIONS_BY_ROLE.md`.

## The pattern

```
Controller (JwtAuthGuard, @CurrentUser) -> Service (buildAuthContext, validate, throw 403) -> Entity (canXxxBy(ctx))
```

1. Each aggregate defines `export interface XAuthContext { userId; isAdmin; ... }` in its entity
   file and `static buildAuthContext(...)` or an instance `buildAuthContext(...)` helper.
2. Rules are entity methods named `canBeViewedBy`, `canBeEditedBy`/`canBeModifiedBy`,
   `canChangeStatusBy(ctx, newStatus)`, `canManagePhotosBy`, `canExpressInterestBy`,
   `canAssignProviderBy`, `canBeModeratedBy`, ... They are pure, synchronous and unit-tested.
3. Services expose `xxxForUser(id, user | userId)` methods that load the aggregate, build the
   context (async: may call other services), check the rule and throw `ForbiddenException` with a
   clear message. Admin bypass is expressed inside the entity rule (`if (ctx.isAdmin) return true`),
   not in the service.
4. Controllers only apply guards, extract `@CurrentUser() user: UserEntity`, and delegate. No
   ownership checks, no `if (user.isAdmin)` branches, no try/catch: Nest maps
   `ForbiddenException/NotFoundException/BadRequestException` to 403/404/400 automatically.

## Active profile flags: single orchestration point

`ProfileActivationService.getActivationStatus(userId)` (Profiles context) returns
`{ hasActiveClientProfile, hasActiveProviderProfile, activeServiceProviderId }`.

- Client active = `user.hasClientProfile && user.isFullyVerified()` (email + phone verified).
- Provider active = (Professional or Company) `profile.canOperate()` && `user.isFullyVerified()`.
- Services that build `RequestAuthContext` (RequestService, RequestInterestService) fill
  `hasActiveClientProfile`, `hasActiveProviderProfile`, `serviceProviderId` from this service.
- NEVER call `user.isFullyVerified()` or `profile.canOperate()` for permission purposes outside
  `ProfileActivationService`. Entities only read the booleans from the context.

Business requirements currently enforced: creating a request and assigning a provider require an
active client; expressing interest requires an active provider; the job board list does not
require an active profile; appearing in `GET /providers` requires an active provider.

## Guards and decorators

- `JwtAuthGuard` from `src/identity/infrastructure/guards/jwt-auth.guard.ts` at controller level;
  `@Public()` (`shared/presentation/decorators/public.decorator.ts`) to open a route.
- `AdminGuard` (`shared/presentation/guards/admin.guard.ts`) for `/admin/*` and moderation routes.
- `ProfessionalGuard`, `RolesGuard`/`@Roles()` exist but are legacy; prefer entity rules.
- The `user` on the request is a full `UserEntity` (loaded by `JwtStrategy`), so
  `user.isAdminUser()`, `user.isClient()`, `user.hasCompanyProfile` are available.

## Adding a permission

Follow the checklist in AUTHORIZATION_PATTERN.md: add/extend `XAuthContext`, add `canXxxBy`,
add `xxxForUser` in the service, simplify the controller, write entity tests (allow/deny per role)
and service tests (`rejects.toThrow(ForbiddenException)`), update `PERMISSIONS_BY_ROLE.md`.
