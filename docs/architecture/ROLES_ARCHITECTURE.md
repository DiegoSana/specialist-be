# User Profiles Architecture - Specialist

> Updated September 2026 - Profile-flag model (Client + Professional/Company provider profiles)

> Authoritative permission matrix: [PERMISSIONS_BY_ROLE.md](../guides/PERMISSIONS_BY_ROLE.md). Authorization mechanics: [AUTHORIZATION_PATTERN.md](./AUTHORIZATION_PATTERN.md). "Active profile" definition: [PROFILE_ACTIVATION_ORCHESTRATION.md](./PROFILE_ACTIVATION_ORCHESTRATION.md).

## Design: Profile Flags, Not Roles

### Overview

There is no role column on `User`. "Roles" are **derived from profile flags** on the user plus the `isAdmin` flag:

- **Client Profile**: Can create service requests, assign a provider, leave reviews
- **Professional Profile**: Individual provider (trades, gallery, ratings)
- **Company Profile**: Business provider (company name, CUIT, trades, gallery, ratings)
- **Admin**: `isAdmin: true`; moderation and back-office

Professional and Company are both **provider profiles** (they share the `ServiceProvider` abstraction, see [ADR-004](../decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md)). A user can have a client profile and one or both provider profiles, but **only one provider profile can operate at a time** (XOR rule below).

> Legacy: `enum UserRole { ADMIN }` still exists in `prisma/schema.prisma`, but no `User` column uses it. Do not add role-based logic on top of it; use the flags.

### Profile Flags

```typescript
User {
  hasClientProfile: boolean;       // Client record exists
  hasProfessionalProfile: boolean; // Professional record exists
  hasCompanyProfile: boolean;      // Company record exists
  isAdmin: boolean;                // Admin privileges
  emailVerified: boolean;          // Needed for an "active" profile
  phoneVerified: boolean;          // Needed for an "active" profile
}
```

### Profile Structure

```
User (Identity)
├── Basic data (email, name, phone, auth provider)
├── hasClientProfile / hasProfessionalProfile / hasCompanyProfile
├── emailVerified / phoneVerified
└── isAdmin

┌─────────────────────────────────────────────────────────┐
│                     PROFILES                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Client Profile (if hasClientProfile)                   │
│  ├── Can search providers (public anyway)              │
│  ├── Can create requests (public or direct)*           │
│  ├── Can view interested providers on own requests     │
│  ├── Can assign a provider to own request              │
│  └── Can review the provider of a completed request    │
│                                                          │
│  Provider Profile (Professional XOR Company operating) │
│  ├── Has trades, gallery, description                  │
│  ├── Appears in GET /providers catalogue*              │
│  ├── Can receive direct requests                        │
│  ├── Can see job board; can express interest*          │
│  ├── Can be assigned; can rate the client              │
│  └── Has ratings and reviews (via ServiceProvider)     │
│                                                          │
│  Admin (if isAdmin)                                     │
│  ├── User management (status, manual verification)     │
│  ├── Professional/Company status changes, verification │
│  ├── Review moderation, notifications, requests list   │
│  └── No implicit client/provider powers                │
│                                                          │
└─────────────────────────────────────────────────────────┘
* requires an ACTIVE profile (see below)
```

### "Active" Profile

Having a profile is not enough to act with it. `ProfileActivationService` (`src/profiles/application/services/profile-activation.service.ts`) is the single place that defines "active":

| Profile | Active when |
|---------|-------------|
| Client | `user.hasClientProfile && user.isFullyVerified()` |
| Professional | `professional.canOperate() && user.isFullyVerified()` |
| Company | `company.canOperate() && user.isFullyVerified()` |

- `user.isFullyVerified()` = `emailVerified && phoneVerified` (admin can override via `PUT /admin/users/:id/verification`).
- `profile.canOperate()` = `status` is `ACTIVE` or `VERIFIED` (both `ProfessionalStatus` and `CompanyStatus`).

The result (`hasActiveClientProfile`, `hasActiveProviderProfile`, `activeServiceProviderId`) is injected into AuthContexts (e.g. `RequestAuthContext`); domain entities never compute the formula themselves.

### XOR Rule: One Operating Provider Profile

`ProfileActivationPolicy` (`src/profiles/domain/services/profile-activation.policy.ts`, pure domain) and `ProfileToggleService` (`src/profiles/application/services/profile-toggle.service.ts`, persistence) enforce that Professional and Company are never both operating:

- Activating one (`POST /professionals/me/activate`, `POST /companies/me/activate`) sets the other to `INACTIVE` if it was operating.
- Admin verifying a Company (`POST /companies/:id/verify`) moves it `PENDING_VERIFICATION → ACTIVE` and deactivates an operating Professional.
- `REJECTED` / `SUSPENDED` profiles cannot be activated. A `PENDING_VERIFICATION` Company cannot self-activate (admin must verify); a `PENDING_VERIFICATION` Professional can (no admin verification in MVP).
- `GET /users/me/provider-profiles` returns both profiles and which one is active.

Details and Company state machine: [COMPANY_PROFILES.md](./COMPANY_PROFILES.md).

## Implementation

### 1. User Entity

```typescript
// src/identity/domain/entities/user.entity.ts
export class UserEntity {
  id: string;
  email: string;
  isAdmin: boolean;
  hasClientProfile: boolean;
  hasProfessionalProfile: boolean;
  hasCompanyProfile: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;

  isClient(): boolean            { return this.hasClientProfile; }
  isProfessional(): boolean      { return this.hasProfessionalProfile; }
  isCompany(): boolean           { return this.hasCompanyProfile; }
  isServiceProvider(): boolean   { return this.hasProfessionalProfile || this.hasCompanyProfile; }
  isAdminUser(): boolean         { return this.isAdmin; }
  isFullyVerified(): boolean     { return this.emailVerified && this.phoneVerified; }
  canCreateRequest(): boolean    { return this.hasClientProfile && this.isActive(); }
}
```

### 2. Profile Entities

```typescript
// src/profiles/domain/entities/client.entity.ts
export class ClientEntity {
  id: string;
  userId: string;
  preferences, savedProfessionals, searchHistory, notificationSettings;
}

// src/profiles/domain/entities/professional.entity.ts
export class ProfessionalEntity {
  id: string;
  userId: string;
  serviceProviderId: string;   // shared rating/reviews aggregate
  trades: TradeInfo[];
  status: ProfessionalStatus;  // PENDING_VERIFICATION | ACTIVE | VERIFIED | INACTIVE | REJECTED | SUSPENDED
  canOperate(): boolean;       // ACTIVE || VERIFIED
  // ... other fields
}

// src/profiles/domain/entities/company.entity.ts
export class CompanyEntity {
  id: string;
  userId: string;
  serviceProviderId: string;
  companyName: string;
  taxId: string | null;        // CUIT, unique
  trades: TradeInfo[];
  status: CompanyStatus;       // same set of values as ProfessionalStatus
  canOperate(): boolean;       // ACTIVE || VERIFIED
  // ... other fields
}
```

Contact data (phone, email) lives on `User`, not on the profile entities.

### 3. Guards and Authorization

Guards only handle **authentication and the admin flag**; everything else is authorization inside services + domain entities (AuthContext pattern, see [AUTHORIZATION_PATTERN.md](./AUTHORIZATION_PATTERN.md)).

```typescript
// Authentication (src/identity/infrastructure/guards/jwt-auth.guard.ts)
@UseGuards(JwtAuthGuard)

// Opt-out for public endpoints (src/shared/presentation/decorators/public.decorator.ts)
@Public()

// Admin only (src/shared/presentation/guards/admin.guard.ts) - requires isAdmin: true
@UseGuards(JwtAuthGuard, AdminGuard)
```

Legacy, **not used by any controller**: `ProfessionalGuard` and `RolesGuard` (`src/shared/presentation/guards/`). Do not use them for new endpoints; "has a profile" is not the same as "has an active profile", so the check belongs in the AuthContext.

Typical flow:

```
Controller  ──JwtAuthGuard──►  Service.buildAuthContext(userId, isAdmin)
                                  └─ ProfileActivationService.getActivationStatus(userId)
                               Service asks entity: request.canExpressInterestBy(ctx), canAssignProviderBy(ctx), review.canBeModeratedBy(ctx), ...
                               Entity answers with flags only (userId, isAdmin, hasActiveClientProfile, hasActiveProviderProfile, serviceProviderId)
                               (Creation has no aggregate yet: RequestService.create checks activation.hasActiveClientProfile directly)
```

## Profile Activation Flow

### Client Profile

```
User registers
    │
    ▼
POST /api/users/me/client-profile   (alias: POST /api/clients)
    │
    ▼
Client record created
hasClientProfile = true
    │
    ▼
Verify email + phone (POST /api/identity/verification/{email,phone}/{request,confirm})
    │
    ▼
Active client → can POST /api/requests (public or direct)
```

### Professional Profile

```
User registers
    │
    ▼
POST /api/professionals/me
    │
    ▼
Professional record + ServiceProvider(type=PROFESSIONAL) created
hasProfessionalProfile = true
status = PENDING_VERIFICATION
    │
    ▼
POST /api/professionals/me/activate  (self-activation allowed in MVP)
    │
    ├──► status = ACTIVE; an operating Company becomes INACTIVE
    │
Admin (PUT /api/admin/professionals/:id/status)
    ├──► VERIFIED (badge) / SUSPENDED / REJECTED
```

### Company Profile

```
POST /api/companies/me
    │
    ▼
Company record + ServiceProvider(type=COMPANY) created
hasCompanyProfile = true
status = PENDING_VERIFICATION   (cannot self-activate)
    │
    ▼
Admin POST /api/companies/:id/verify
    │
    ▼
status = ACTIVE; an operating Professional becomes INACTIVE
```

In all cases the profile is only **active** (appears in `GET /providers`, can express interest, be assigned) once the user also has email and phone verified.

## Advantages

✅ **Flexibility**: One user can be client and provider (Professional or Company)
✅ **Simplicity**: Single authentication, capabilities derived from flags
✅ **Scalability**: Company was added as a new profile type without touching Identity roles
✅ **UX**: Switching between Professional and Company keeps each one's history and reviews
✅ **Data Integrity**: One operating provider profile at a time; contact data lives once, on `User`

## API Permissions

The full matrix is maintained in [PERMISSIONS_BY_ROLE.md](../guides/PERMISSIONS_BY_ROLE.md). Highlights that differ from a naive role model:

| Endpoint | Anyone | Active Client | Active Provider | Admin |
|----------|--------|---------------|-----------------|-------|
| `GET /providers`, `GET /professionals`, `GET /companies` | ✅ (public) | ✅ | ✅ | ✅ |
| `POST /requests` | ❌ | ✅ | ❌ | ❌ (only if also an active client) |
| `GET /requests/available` (job board) | ❌ | ❌ | ✅ (any provider profile, active or not; only trades are used) | ❌ (only if also a provider) |
| `POST /requests/:id/interest` | ❌ | ❌ | ✅ | ❌ |
| `POST /requests/:id/assign-provider` | ❌ | ✅ (own request) | ❌ | ✅ (`canAssignProviderBy` allows admin) |
| `POST /reviews` | ❌ | ✅ (own completed request) | ❌ | ❌ |
| `POST /reviews/:id/approve`, `/reject`, `GET /reviews/admin/pending` | ❌ | ❌ | ❌ | ✅ |
| `GET /admin/*` | ❌ | ❌ | ❌ | ✅ |

Admin privileges are additive to whatever profiles the admin user has; they never grant client or provider actions by themselves.

---

*Last Updated: September 2026*
