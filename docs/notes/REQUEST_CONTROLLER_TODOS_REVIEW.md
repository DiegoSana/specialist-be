# Request controller TODOs – review and recommendations

Quick review of each TODO in `requests.controller.ts` and suggested actions.

**Status (2026-02-05):** All items below have been implemented: (1) findMyRequests/findAvailable support Company via `resolveProviderContext`; (2) findAvailable also requires active provider; (3) limited view moved to `RequestService.findByIdForInterestedProvider` + `RequestResponseDto.fromEntityLimited`; (4) exception-handling TODOs removed; (5) `RateClientDto` with validation. See TODO.md “Donde quedamos hoy” and Fase A.3.

---

## 1. **findMyRequests** – “review cases role company” (line 84)

**Current behavior:**  
- `role=client` or no role and user is client → requests as client.  
- `role=professional` or no role and user is professional → requests as provider (via `professionalService.findByUserId`).  
- Else → `[]`.

**Gap:** Users who are **Company only** (no Professional profile) never get provider requests; they fall into `entities = []`.

**Recommendation:** Treat “provider” as Professional **or** Company.

- If `role === 'professional'` or no role and user has **any** provider profile (`user.hasProfessionalProfile || user.hasCompanyProfile`):
  - Resolve `serviceProviderId`: try Professional first, then Company (same idea as `buildAuthContext`).
  - Call `requestService.findByProviderId(serviceProviderId)`.
- Implementation: inject `CompanyService`; try `professionalService.findByUserId(user.id)`, on NotFound try `companyService.findByUserId(user.id)`; use whichever profile’s `serviceProviderId`. Optionally extract “get current user’s provider id” to a small helper or to `RequestService`/`ProfileActivationService` to avoid duplicating the try/catch in the controller.

---

## 2. **findAvailable** – “review cases role company” (line 105)

**Current behavior:**  
- Requires `user.hasProfessionalProfile`, then loads professional and uses `findAvailableForProfessional(professional.tradeIds, city, zone)`.

**Gap:** Users with **Company** (and no Professional) get `BadRequestException('Only professionals can view available requests')`, but they should also see the job board.

**Recommendation:** Allow any provider (Professional or Company).

- Guard: require “is provider” → `user.hasProfessionalProfile || user.hasCompanyProfile` (or use a single `user.hasAnyProviderProfile()` if it exists on `UserEntity`).
- Resolve profile: try Professional first, then Company (same as above).
- Get `tradeIds` (and optionally `city`, `zone` from the profile) from whichever profile exists; both have `tradeIds`.
- Call existing `requestService.findAvailableForProfessional(tradeIds, city, zone)` (name is legacy but works for any provider with tradeIds).
- Optional: require “active provider” (e.g. build auth context and check `hasActiveProviderProfile`) so only verified providers see the board; if you do that, use the same pattern as in PROFILE_ACTIVATION_ORCHESTRATION.

---

## 3. **findById – limited view for interested-but-not-assigned provider** (line 151)

**Current behavior:** When a provider gets 403 but they had expressed interest, the controller loads the request, maps to DTO, then **in the controller** nulls out sensitive fields (address, photos, client, professional, etc.) and returns that.

**Issue:** This is “different request information” / view model logic living in the controller.

**Recommendation:** Move to application layer.

- Add something like `requestService.findByIdForInterestedProvider(id, ctx)` (or a similar name) that:
  - Returns a request view that is already limited (e.g. only title, description, status, createdAt, no address/photos/client/professional/company/availability/rating).
- Controller only calls that method and maps the result to `RequestResponseDto` (or a dedicated “limited” DTO if you want a different shape).
- Keeps controller thin and makes the “limited view” rule testable and reusable.

---

## 4. **updateStatus / addRequestPhoto / removeRequestPhoto / removeInterest – “can throw, handle in controller?”** (lines 188, 209, 228, 267)

**Current behavior:** Controller calls the service and returns; no try/catch.

**What the services throw:** Typically `ForbiddenException`, `NotFoundException`, `BadRequestException` (and possibly others). Nest’s default exception layer turns these into the right HTTP status (403, 404, 400).

**Recommendation:** No change needed.

- Let exceptions bubble; Nest handles them.
- Only add controller-level try/catch if you need to:
  - Transform the error (e.g. custom message or body), or
  - Log differently, or
  - Return a different status in specific cases.
- You can remove these TODOs or replace with a short comment: “Exceptions (e.g. 403/404) are handled by Nest’s exception layer.”

---

## 5. **rateClient – “validate rating number and comment in the controller?”** (line 406)

**Current behavior:** Body `{ rating: number; comment?: string }` is passed straight to the service. No validation of range or length.

**Recommendation:** Validate at the edge with a DTO + class-validator.

- Create a DTO, e.g. `RateClientDto`, with:
  - `rating`: `@IsNumber()`, `@Min(1)`, `@Max(5)` (or whatever your domain allows).
  - `comment`: `@IsOptional()`, `@IsString()`, `@MaxLength(500)` (or your max).
- Use that DTO as `@Body() body: RateClientDto` so ValidationPipe runs before the controller method.
- Service can keep its own checks if needed (e.g. “only assigned provider can rate”); controller is responsible for format/range/length. Fix typo: “raining” → “rating” in the TODO.

---

## Summary table

| TODO | Location | Action |
|------|----------|--------|
| Role company (findMyRequests) | ~84 | Support Company as provider; resolve serviceProviderId from Professional or Company; call findByProviderId. |
| Role company (findAvailable) | ~105 | Allow Company; resolve tradeIds from Professional or Company; keep findAvailableForProfessional. |
| Limited view for interested provider | ~151 | Move “limited request view” to RequestService (e.g. findByIdForInterestedProvider) and use it from controller. |
| updateStatus / addPhoto / removePhoto / removeInterest exceptions | ~188, 209, 228, 267 | No change; document that Nest handles exceptions, or remove TODOs. |
| rateClient validation | ~406 | Add RateClientDto with class-validator; fix “raining” → “rating”. |

After implementation you can remove or shorten the TODOs and point to this doc or to PERMISSIONS_BY_ROLE / PROFILE_ACTIVATION_ORCHESTRATION where relevant.
