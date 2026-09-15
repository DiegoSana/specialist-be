# Profiles context (`src/profiles`)

Owns business profiles attached to a `User`: `Client`, `Professional`, `Company`, the polymorphic
`ServiceProvider` (ADR-004), `Trade` catalog, and the "active profile" orchestration.
Docs: `docs/architecture/COMPANY_PROFILES.md`, `docs/architecture/PROFILE_ACTIVATION_ORCHESTRATION.md`,
`docs/decisions/ADR-001-DUAL-PROFILE-ARCHITECTURE.md`, `ADR-004-SERVICE-PROVIDER-ABSTRACTION.md`.

## Public API (exported by `ProfilesModule`)

- `ClientService`: `getProfile`, `updateProfile`, `activateClientProfile(userId)`.
- `ProfessionalService`: `search`, `findById`, `getByIdOrFail`, `findByUserId`,
  `findByServiceProviderId`, `findByIdWithFullGallery`, `createProfile`, `updateProfile`,
  `addGalleryItem`, `removeGalleryItem`, `updateRating`, `updateStatus`,
  `activateProfessionalProfile`, `getProfessionalStats`, `getAllProfessionalsForAdmin`,
  `getProfessionalByIdForAdmin`.
- `CompanyService`: same shape plus `verifyCompany`, `activateCompanyProfile`, `getCompanyStats`,
  `getAllCompaniesForAdmin`, `getCompanyByIdForAdmin`.
- `TradeService`: `findAll`, `findById`, `create`, `update`.
- `ProfileToggleService`: `activateCompanyProfile`, `activateProfessionalProfile`,
  `getActiveProfile`, `getUserProfiles`, `handleCompanyVerification`. Applies the domain policy
  `ProfileActivationPolicy` (`domain/services/profile-activation.policy.ts`): only ONE provider
  profile (Professional XOR Company) can be operable; activating one sets the other `INACTIVE`.
- `ProfileActivationService.getActivationStatus(userId)` ->
  `{ hasActiveClientProfile, hasActiveProviderProfile, activeServiceProviderId }`. The single place
  that composes `user.isFullyVerified()` with `profile.canOperate()`. All AuthContexts in other
  contexts get their active-profile flags from here.

## Endpoints

`/professionals` GET(public search), `/:id` GET(public), `/me/profile` GET, `/me` POST/PATCH,
`/me/gallery` POST/DELETE, `/me/activate` POST. `/companies` same set plus `/:id/verify` POST (admin).
`/providers` GET (public unified catalog, `providerType=PROFESSIONAL|COMPANY|ALL`, only active
providers: `onlyActiveInCatalog` -> `userVerified` filter + `canOperate`). `/trades` GET,
`/trades/with-professionals`, `/trades/:id` (public). `/clients` POST.

## Entities

- `ServiceProviderEntity { id, type: ProviderType, averageRating, totalReviews }`:
  `createForProfessional/createForCompany`, `canReceiveRequests`, `canBeReviewed`,
  `withUpdatedRating`, `withRemovedRating`. Rating math lives here, not in Professional/Company.
- `ProfessionalEntity` / `CompanyEntity`: `serviceProviderId`, `tradeIds`, `primaryTrade`, `city`,
  `zone`, gallery, `status`. Predicates `canOperate()` (= status `ACTIVE|VERIFIED`),
  `isActive()`, `isVerified()`, `hasVerifiedBadge()`, `canBeActivated()`, `canBeDeactivated()`,
  `isOwnedBy(userId)`. Auth: `ProfessionalAuthContext`/`CompanyAuthContext` +
  `canViewFullProfileBy`, `canBeEditedBy`, `canManageGalleryBy`, `canChangeStatusBy`.
  Statuses: `PENDING_VERIFICATION|ACTIVE|VERIFIED|INACTIVE|REJECTED|SUSPENDED`.
- `ClientEntity`: `createForUser`, `withChanges`, saved professionals list.
- `TradeEntity`: catalog item with `category`.

## Repositories / queries

Aggregate repos with `save()`: Client, Professional, Company, Trade. Query repos:
`ProfessionalQueryRepository`, `CompanyQueryRepository` (stats + admin lists). Mappers per
aggregate plus `service-provider.prisma-mapper.ts`.

## Invariants and gotchas

- Profiles have NO contact fields and NO `active` boolean (removed in migration
  `20260206000000_remove_profile_contact_and_active`). Operability is `status` only.
- `Company.taxId` (CUIT `XX-XXXXXXXX-X`) is unique system-wide. Company activation requires
  admin verification (`ACTIVE|VERIFIED`); a Professional in `PENDING_VERIFICATION` may self-activate (MVP).
- Company and Professional keep independent review histories (separate `ServiceProvider` rows).
- `RequestsModule` and `ReputationModule` depend on this module via `forwardRef`; keep new
  cross-context needs as service methods, not repository exports.
- Search/catalog must never expose the owner's phone/email; those belong to `User` and are only
  shown to request participants.

## Tests

`client.service.spec.ts`, `professional.service.spec.ts`, `trade.service.spec.ts`,
`company.entity.spec.ts`, `service-provider.entity.spec.ts`. Factory: `createMockProfessional`.
Missing (backlog): `profile-activation.service.spec.ts`, `company.service.spec.ts`.
