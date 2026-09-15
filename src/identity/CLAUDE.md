# Identity context (`src/identity`)

Owns the `User` aggregate, authentication (local, Google, Facebook, JWT) and email/phone
verification. Does NOT own client/professional/company profiles (Profiles context).

## Public API (exported by `IdentityModule`)

- `UserService`: `findById(id, includeProfiles?)`, `findByIdOrFail`, `findByEmail`, `update`,
  `exists`, `findByIdForUser`, `updateForUser`, `updateStatusForUser`, `updateVerificationForUser`
  (admin override), `getUserStats`, `getAllUsersForAdmin` (via `UserQueryRepository`).
- `AuthenticationService`: `register`, `login`, `validateUser`, `validateUserById`, `googleLogin`,
  `facebookLogin`. Registration activates the client profile through `ClientService`
  (Profiles), never through a repository.
- `VerificationService` (application): `requestPhoneVerification`, `confirmPhoneVerification`,
  `requestEmailVerification`, `confirmEmailVerification`; uses the domain port
  `VERIFICATION_SERVICE` implemented by `TwilioVerifyService`.
- `JwtStrategy`, `JwtAuthGuard` (`infrastructure/guards/jwt-auth.guard.ts`): the guard every other
  controller imports. `JwtStrategy` loads the full `UserEntity` (with profile flags) into `request.user`.

## Endpoints

`/auth/register|login|google|google/callback|facebook|facebook/callback` (all `@Public()`),
`/users/me` GET/PATCH, `/users/me/client-profile` POST, `/users/me/provider-profiles` GET,
`/identity/verification/phone|email/request|confirm` POST.

## UserEntity essentials

- Immutable; factories `createLocal`, `createOAuth`; mutators return copies: `withUpdatedProfile`,
  `withStatus`, `linkGoogle`, `linkFacebook`, `withPhoneVerified`, `withEmailVerified`,
  `withVerificationOverrides`.
- Flags derived from relations at read time: `hasClientProfile`, `hasProfessionalProfile`,
  `hasCompanyProfile` (repository must `include` relations; `findById(id, true)`).
- Predicates: `isClient()`, `isProfessional()`, `isCompany()`, `isServiceProvider()`,
  `isAdminUser()`, `isActive()`, `isFullyVerified()` (email AND phone verified),
  `canCreateProfessionalProfile()`, `canCreateCompanyProfile()`, `canCreateRequest()`.
- `UserAuthContext` + `canBeViewedBy/canBeEditedBy/canChangeStatusBy/canBeDeletedBy`,
  `static buildAuthContext(userId, isAdmin)`.
- `UserStatus`: `PENDING|ACTIVE|SUSPENDED|BANNED`. `AuthProvider`: `LOCAL|GOOGLE|FACEBOOK`.
  `password` is null for OAuth users.

## Invariants and gotchas

- Contact data (`phone`, `email`, `phoneVerified`, `emailVerified`) lives only here. Profiles have
  no contact fields.
- `isFullyVerified()` is a fact about the user; the *permission* meaning ("active profile") is
  computed only in `ProfileActivationService` (Profiles). Do not add verification-based permission
  checks in other contexts.
- `UserRole` enum and `RolesGuard` are legacy from the pre-profile-flags design; prefer entity rules.
- JWT payload carries `sub` (user id), `email` and `isAdmin`. Expiry is read from `JWT_EXPIRES_IN`
  (default `7d`) in `identity.module.ts`, with `JWT_EXPIRATION` accepted as a legacy fallback.
- OAuth callbacks redirect to `FRONTEND_URL` with the token; callback URLs come from
  `GOOGLE_CALLBACK_URL` / `FACEBOOK_CALLBACK_URL`.
- Verification codes go through Twilio Verify (`TWILIO_VERIFY_SERVICE_SID`); in tests mock the
  `VERIFICATION_SERVICE` token.

## Tests

`authentication.service.spec.ts`, `verification.service.spec.ts`. Factories: `createMockUser` in
`src/__mocks__/test-utils.ts`.
