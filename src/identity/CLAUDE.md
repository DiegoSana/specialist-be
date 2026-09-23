# Identity context (`src/identity`)

Owns the `User` aggregate, authentication (local, Google, Facebook, JWT) and email/phone
verification. Does NOT own client/professional/company profiles (Profiles context).

## Public API (exported by `IdentityModule`)

- `UserService`: `findById(id, includeProfiles?)`, `findByIdOrFail`, `findByEmail`, `update`,
  `exists`, `findByIdForUser`, `updateForUser`, `updateStatusForUser`, `updateVerificationForUser`
  (admin override), `getUserStats`, `getAllUsersForAdmin` (via `UserQueryRepository`, includes
  `whatsappOptedOut`/`whatsappOptedOutAt` per row), `setWhatsAppOptedOut(userId, optedOut)`,
  `updateWhatsAppOptOutForUser(targetUserId, actingUser, optedOut)` (admin override, no-op if
  unchanged, delegates to `setWhatsAppOptedOut`), `reactivateWhatsAppForUser(userId)` (self-service,
  no-op if not opted out, else delegates to `setWhatsAppOptedOut(userId, false)`; one-directional -
  there is no self-service opt-out), `findAdminUserIds()` (via `UserQueryRepository`,
  no fixed/hardcoded admin id — used to fan out admin notifications, see Requests context's
  `RequestAttentionFlaggedHandler`).
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
`/users/me` GET/PATCH (now also returns `whatsappOptedOut`/`whatsappOptedOutAt` via
`UserProfileResponseDto`), `/users/me/client-profile` POST, `/users/me/whatsapp-reactivate` POST
(self-service reactivation, see `UserService.reactivateWhatsAppForUser`), `/users/me/provider-profiles`
GET, `/identity/verification/phone|email/request|confirm` POST.

## UserEntity essentials

- Immutable; factories `createLocal`, `createOAuth`; mutators return copies: `withUpdatedProfile`,
  `withStatus`, `linkGoogle`, `linkFacebook`, `withPhoneVerified`, `withEmailVerified`,
  `withVerificationOverrides`, `withWhatsAppOptedOut(optedOut, now?)`.
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

- Contact data (`phone`, `email`, `phoneVerified`, `emailVerified`, `whatsappOptedOut`,
  `whatsappOptedOutAt`) lives only here. Profiles have no contact fields. `whatsappOptedOut` is
  gated into `ProfileActivationService`'s "active profile" computation (Profiles context) — an
  opted-out user can't take/request new requests, but their already-assigned requests are left
  alone (see Requests context's WhatsApp follow-up notes).
- `domain/events/user-whatsapp-opted-out.event.ts` (`UserWhatsAppOptedOutEvent`,
  `identity.user.whatsapp_opted_out`) is the first domain event from this context. Published from
  `UserService.setWhatsAppOptedOut` on the `false -> true` transition, regardless of whether the
  caller was the WhatsApp reply classifier (Requests context) or the admin manual override
  (`updateWhatsAppOptOutForUser`, `PUT /admin/users/:id/whatsapp-opt-out`). Its sibling
  `domain/events/user-whatsapp-reactivated.event.ts` (`UserWhatsAppReactivatedEvent`,
  `identity.user.whatsapp_reactivated`) is published from the same method on the `true -> false`
  transition — reachable via the admin override or the self-service `POST
  /users/me/whatsapp-reactivate` (`UserService.reactivateWhatsAppForUser`); there is still no
  self-service/automatic opt-out path (only the admin override or the WhatsApp reply classifier
  can set it to `true`). Neither event fires when the value doesn't actually change. Both are consumed by
  `UserWhatsAppOptedOutHandler` in the Notifications context (mirrors
  `RequestAttentionFlaggedHandler`'s cross-context pattern — do not import `NotificationsModule`
  into `IdentityModule`).
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
