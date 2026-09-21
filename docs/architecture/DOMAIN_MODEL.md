# Domain Model - Specialist

> Updated September 2026 - Reflects the current bounded contexts, the `ServiceProvider`
> abstraction (ADR-004), Company profiles, WhatsApp follow-up interactions, the
> notifications context and the profile activation rules.
>
> Source of truth for fields and enums is `prisma/schema.prisma`; domain behaviour lives in
> `src/*/domain/entities/*.entity.ts`. When this document and the code disagree, the code wins.

## Bounded Contexts

| Context | Module | Aggregates | Association stores / logs |
|---------|--------|------------|---------------------------|
| Identity | `src/identity` | `User` | - |
| Profiles | `src/profiles` | `Client`, `Professional`, `Company`, `Trade` (+ `ServiceProvider` parent) | `ProfessionalTrade`, `CompanyTrade` (persisted inside the profile aggregate) |
| Requests | `src/requests` | `Request`, `RequestInteraction` | `RequestInterest` |
| Reputation | `src/reputation` | `Review` | - |
| Notifications | `src/notifications` | `Notification` (+ `NotificationDelivery`), `NotificationPreferences`, `InAppNotification` (legacy) | - |
| Contact | `src/contact` | - | `Contact` (append-only log) |
| Storage | `src/storage` | `File` (not persisted in Prisma; port-backed) | - |
| Admin / Health / Shared | `src/admin`, `src/health`, `src/shared` | none (read models, cross-cutting) | - |

---

### 1. Identity Context
**Purpose**: Manages user identity, authentication and contact verification.

**Aggregate Root**: `User`

**Key Fields** (`users`):
- `email` (unique), `password` (null for OAuth users)
- `firstName`, `lastName`, `phone`, `profilePictureUrl`
- `authProvider`: `LOCAL | GOOGLE | FACEBOOK`; `googleId`, `facebookId` (unique, nullable)
- `emailVerified`, `phoneVerified` (booleans, default `false`)
- `isAdmin`, `status`: `UserStatus`

**Derived (not columns)**: `hasClientProfile`, `hasProfessionalProfile`, `hasCompanyProfile` are computed by
the mapper from the included `client` / `professional` / `company` relations.

**Domain behaviour**: `isActive()` (`status === ACTIVE`), `isFullyVerified()` (`emailVerified && phoneVerified`),
`withUpdatedProfile()` resets the corresponding verified flag when `email` or `phone` changes.

**Repositories**: `UserRepository` (save-based: `findById`, `findByEmail`, `findByGoogleId`, `findByFacebookId`,
`save`), `UserQueryRepository` (admin read model: `getUserStats`, `findAllForAdmin`).

**Domain events emitted**: none.

> Since migration `20260206000000_remove_profile_contact_and_active`, contact data (phone, email) and the
> verification flags live **only** on `User`. Profiles no longer have `whatsapp`, `phone`, `email` or an
> `active` boolean.

---

### 2. Profiles Context
**Purpose**: Business profiles (Client, Professional, Company), the polymorphic `ServiceProvider` parent and
the service catalogue (`Trade`).

**Aggregate Roots**:
- `Client` - client profile (can create requests). `User 1:0..1 Client`.
- `Professional` - individual provider. `User 1:0..1 Professional`, `Professional 1:1 ServiceProvider`.
- `Company` - business provider. `User 1:0..1 Company`, `Company 1:1 ServiceProvider`.
- `Trade` - service category. `Professional N:M Trade` via `ProfessionalTrade`; `Company N:M Trade` via `CompanyTrade`
  (both carry `isPrimary`, unique per pair).

**`ServiceProvider`** (ADR-004) is the polymorphic parent of `Professional` and `Company`:
`type: PROFESSIONAL | COMPANY`, `averageRating` (Float), `totalReviews` (Int). Requests, interests and reviews
reference `ServiceProvider.id`, never the concrete child. It has no repository of its own: it is created
together with its child and updated through `ProfessionalRepository.updateRating` /
`CompanyRepository.updateRating`. `ProfessionalEntity` / `CompanyEntity` expose `averageRating` and
`totalReviews` as getters delegating to the attached `ServiceProviderEntity`.


**Statuses** (identical semantics for both provider types):

| Status | Meaning | `canOperate()` |
|--------|---------|----------------|
| `PENDING_VERIFICATION` | New profile, awaiting verification (default) | no |
| `ACTIVE` | Can operate | **yes** |
| `VERIFIED` | Can operate + special badge (`hasVerifiedBadge()`) | **yes** |
| `INACTIVE` | Deactivated because the user's other provider profile is active | no |
| `REJECTED` | Verification failed | no |
| `SUSPENDED` | Suspended by admin | no |

**Repositories** (save-based): `ClientRepository` (`save`, `delete`), `ProfessionalRepository` (`save`,
`updateStatus`, `updateRating`, `findByServiceProviderId`, `search`), `CompanyRepository` (`save`, `updateStatus`,
`updateRating`, `findByTaxId`, `findByServiceProviderId`, `search`, `delete`), `TradeRepository` (`save`).
Query repositories: `ProfessionalQueryRepository`, `CompanyQueryRepository` (admin stats and listings).

**Domain services**: `ProfileActivationPolicy` (pure domain, XOR rule below). Application-level orchestration:
`ProfileToggleService` (activate one profile, deactivate the other) and `ProfileActivationService`
("active profile" definition below).

**Domain events emitted**: none.

---

### 3. Requests Context
**Purpose**: Service request lifecycle, provider interest on public requests, and WhatsApp follow-up
interactions.

**Aggregate Roots**:
- `Request` - service request (public or direct). `clientId` references **`User.id`** (the client user),
  `providerId` references `ServiceProvider.id`.
- `RequestInteraction` - one outbound/inbound WhatsApp message tied to a request (follow-up, response,
  status update). Own state machine; see below.

**Association store**:
- `RequestInterest` - a provider's interest in a public request. Added/removed, never updated; unique per
  `(requestId, serviceProviderId)`.

**Request Types**:
- **Direct** (`isPublic: false`) - Client -> a specific `ServiceProvider` (`providerId` set at creation).
- **Public** (`isPublic: true`) - Client -> any provider of the `tradeId`; providers express interest, the
  client assigns one (`providerId` set on assignment, status -> `ACCEPTED`).

**Repositories**: `RequestRepository` (save-based: `findById`, `findByClientId`, `findByProviderId`,
`findPublicRequests`, `findAvailableForProfessional`, `findByStatusAndUpdatedBefore`,
`findPendingWithInterestsUpdatedBefore`, `save`), `RequestInteractionRepository` (save-based, plus
`findPendingFollowUps`, `findByTwilioMessageSid`, `hasPendingFollowUp`, `findFailedRetryable`,
`findSentButNotDelivered`, ...), `RequestInterestRepository` (association store: `add`, `remove`,
`removeAllByRequestId`, `findByRequestId`, `findByServiceProviderId`, `findByRequestAndProvider`),
`RequestQueryRepository` (admin stats).

**Ports**: `WhatsAppMessagingPort` / `TwilioWhatsAppPort` (outbound messages, status callbacks).

**Domain events emitted**:

| Event name | Published by | Consumed by |
|------------|--------------|-------------|
| `requests.request.created` | `RequestService.create` | `RequestsNotificationsHandler` (no-op today) |
| `requests.request_interest.expressed` | `RequestInterestService.expressInterest` | `RequestsNotificationsHandler` -> `REQUEST_INTEREST_EXPRESSED` |
| `requests.request.professional_assigned` | `RequestInterestService.assignProvider` | `RequestsNotificationsHandler` -> `REQUEST_PROFESSIONAL_ASSIGNED` |
| `requests.request.status_changed` | `RequestService.updateStatus`, assign/unassign | `RequestsNotificationsHandler` -> `REQUEST_STATUS_CHANGED` |
| `requests.interaction.responded` | `RequestInteractionService` (inbound WhatsApp webhook) | `RequestInteractionRespondedHandler` (maps intent to request status) |

Event payloads carry `serviceProviderId`, `providerUserId` and `providerType`; the `professionalId`
fields are kept only for backward compatibility and hold the `serviceProviderId`.

---

### 4. Reputation Context
**Purpose**: Reviews and ratings, with admin moderation.

**Aggregate Root**: `Review` (`serviceProviderId` -> `ServiceProvider`, `reviewerId` -> `User`,
`requestId` -> `Request`, **unique**).

**Rules**:
- Only after the `Request` is `DONE` (`RequestEntity.canBeReviewed()`).
- One Review per Request (`Review.requestId @unique`).
- `rating` 1..5 (`Rating` value object).
- Moderation: `PENDING -> APPROVED | REJECTED` (`moderatedAt`, `moderatedBy`). Only `APPROVED` reviews are
  public and counted; approval recalculates `ServiceProvider.averageRating` / `totalReviews`.
- Professional and Company keep independent review histories (each has its own `ServiceProvider`).

**Repository**: `ReviewRepository` (save-based: `findById`, `findByServiceProviderId`,
`findApprovedByServiceProviderId`, `findByRequestId`, `findByStatus`, `save`, `delete`).

**Domain events emitted**: `reputation.review.approved` (`ReviewService.approve`) -> consumed by
`ReviewsNotificationsHandler` (`REVIEW_APPROVED` notification to `providerUserId`).

---

### 5. Notifications Context
**Purpose**: Multi-channel notifications driven by domain events, with per-user preferences.

**Aggregate Roots**:
- `Notification` - the intent (`type`, `title`, `body`, `data`, optional unique `idempotencyKey`) plus its
  `deliveries` (one `NotificationDelivery` per channel; unique `(notificationId, channel)`). In-app read state is
  `deliveries[IN_APP].readAt`.
- `NotificationPreferences` - one per user: `inAppEnabled`, `externalEnabled`,
  `preferredExternalChannel: EMAIL | WHATSAPP`, per-type `overrides` (JSON).
- `InAppNotification` - **legacy** single-channel table (`in_app_notifications`), kept for backward
  compatibility; new notifications use `Notification` + `NotificationDelivery`.

**Notification types**: `REQUEST_STATUS_CHANGED`, `REQUEST_INTEREST_EXPRESSED`,
`REQUEST_PROFESSIONAL_ASSIGNED`, `REVIEW_APPROVED`.

**Repositories**: `NotificationRepository` (`create`, `findById`, `findByIdempotencyKey`, `listForUser`,
`markInAppRead`, `markAllInAppRead`, `markForResend`, `listAll`, `getDeliveryStats`),
`NotificationPreferencesRepository` (`findByUserId`, `upsert`), `InAppNotificationRepository` (`create`, `save`,
`list`, `markAllRead`). Ports: `EmailSender`, `NotificationDeliveryQueue` (used by `NotificationDispatchJob`).

**Jobs**: `NotificationDispatchJob` (external channels, exponential backoff, `attemptCount`/`nextAttemptAt`),
`NotificationRetentionJob` (deletes old notifications).

**Domain events emitted**: none (consumer only).

---

### 6. Contact Context
**Purpose**: Audit log of "contact" actions (e.g. a client tapping WhatsApp on a provider profile).

**`Contact`** is an **append-only log**, not an aggregate: `fromUserId`, `toUserId` (both `User`),
`contactType` (default `"whatsapp"`), `message`, `createdAt`. `ContactRepository` exposes `create` and
`findByUserId` only; rows are never updated or deleted by the domain.

---

### 7. Storage Context
**Purpose**: File upload/serving for profile pictures, gallery media and request photos.

`FileEntity` (`category: profile-picture | project-image | project-video | request-photo`, `ownerId`,
`requestId`) is **not** a Prisma model; it is produced by the `FileStoragePort` (`upload`, `delete`, `getUrl`,
`exists`, `findByPath`, `findById`). URLs are stored as strings on `User.profilePictureUrl`,
`Professional.profileImage/gallery`, `Company.profileImage/gallery` and `Request.photos`.

---

## Enums (from `prisma/schema.prisma`)

| Enum | Values | Used by |
|------|--------|---------|
| `UserStatus` | `PENDING`, `ACTIVE`, `SUSPENDED`, `BANNED` | `User.status` |
| `AuthProvider` | `LOCAL`, `GOOGLE`, `FACEBOOK` | `User.authProvider` |
| `ProviderType` | `PROFESSIONAL`, `COMPANY` | `ServiceProvider.type` |
| `ProfessionalStatus` | `PENDING_VERIFICATION`, `ACTIVE`, `VERIFIED`, `INACTIVE`, `REJECTED`, `SUSPENDED` | `Professional.status` |
| `CompanyStatus` | `PENDING_VERIFICATION`, `ACTIVE`, `VERIFIED`, `INACTIVE`, `REJECTED`, `SUSPENDED` | `Company.status` |
| `RequestStatus` | `PENDING`, `ACCEPTED`, `IN_PROGRESS`, `DONE`, `CANCELLED` | `Request.status` |
| `ReviewStatus` | `PENDING`, `APPROVED`, `REJECTED` | `Review.status` |
| `InteractionType` | `FOLLOW_UP`, `RESPONSE`, `STATUS_UPDATE` | `RequestInteraction.interactionType` |
| `InteractionStatus` | `PENDING`, `SENT`, `DELIVERED`, `RESPONDED`, `FAILED` | `RequestInteraction.status` |
| `InteractionDirection` | `TO_CLIENT`, `TO_PROVIDER` | `RequestInteraction.direction` |
| `ResponseIntent` | `CONFIRMED`, `STARTED`, `COMPLETED`, `CANCELLED`, `NEEDS_INFO`, `UNKNOWN` | `RequestInteraction.responseIntent` |
| `NotificationChannel` | `IN_APP`, `EMAIL`, `WHATSAPP` | `NotificationDelivery.channel` |
| `NotificationDeliveryStatus` | `PENDING`, `SENT`, `FAILED`, `SKIPPED` | `NotificationDelivery.status` |
| `ExternalNotificationChannel` | `EMAIL`, `WHATSAPP` | `NotificationPreferences.preferredExternalChannel` |
| `UserRole` | `ADMIN` | declared in schema, not referenced by any model (`User.isAdmin` is used instead) |

---

## Relationships Diagram

```
                       IDENTITY                                   CONTACT
              ┌──────────────────────┐                     ┌────────────────────┐
              │        User          │ fromUser / toUser   │      Contact       │
              │ email*, phone        │◄────────────────────│ (append-only log)  │
              │ emailVerified        │                     └────────────────────┘
              │ phoneVerified        │
              │ status: UserStatus   │           NOTIFICATIONS
              │ isAdmin              │◄──────┐   ┌──────────────────────────────┐
              └──┬──────┬──────┬─────┘       │   │ Notification ─1:N─ Delivery  │
        1:0..1   │      │      │  1:0..1     ├───│ NotificationPreferences (1:1)│
     ┌───────────┘      │      └──────────┐  │   │ InAppNotification (legacy)   │
     ▼                  │ 1:0..1          ▼  │   └──────────────────────────────┘
┌──────────┐            ▼           ┌──────────┐ │
│  Client  │     ┌──────────────┐   │ Company  │ │
└──────────┘     │ Professional │   │ taxId*   │ │
   (PROFILES)    └──────┬───────┘   └────┬─────┘ │
                        │ 1:1            │ 1:1   │
                        ▼                ▼       │
                 ┌────────────────────────────┐  │
                 │      ServiceProvider       │  │
                 │ type: PROFESSIONAL|COMPANY │  │
                 │ averageRating, totalReviews│  │
                 └───┬──────────┬──────────┬──┘  │
   N:M via           │          │          │     │
   ProfessionalTrade │ provider │ interest │ reviewed
   / CompanyTrade    │ (0..1)   │ (N)      │ (N)
   ┌───────┐         ▼          ▼          ▼     │
   │ Trade │   ┌──────────┐ ┌──────────────────┐ │        REPUTATION
   └───┬───┘   │ Request  │ │ RequestInterest  │ │   ┌───────────────────┐
       │ 0..1  │ clientId ├─┤ (requestId,      │ │   │      Review       │
       └──────►│ → User   │ │  serviceProvider)│ │   │ requestId* → Req  │
               │ providerId│ │  unique          │ │   │ reviewerId → User │
               │ → SP      │ └──────────────────┘ ├───┤ moderatedBy → User│
               │ status    │                      │   │ status: Review-   │
               │ isPublic  │ 1:N                  │   │   Status          │
               └────┬──────┘◄─────────────────────┘   └───────────────────┘
                    │ 1:N
                    ▼
            ┌────────────────────┐
            │ RequestInteraction │   REQUESTS
            │ (WhatsApp follow-up│
            │  state machine)    │
            └────────────────────┘

  * = unique.  Request.clientId, Review.reviewerId and Contact.* point to User, not to Client.
```

---

## Domain Model Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                        IDENTITY CONTEXT                          │
├─────────────────────────────────────────────────────────────────┤
│  User (users)                                                    │
│  ├── id: UUID                                                    │
│  ├── email: string (unique)                                      │
│  ├── password: string | null (OAuth users)                       │
│  ├── firstName, lastName: string                                 │
│  ├── phone: string | null                                        │
│  ├── profilePictureUrl: string | null                            │
│  ├── emailVerified, phoneVerified: boolean (default false)       │
│  ├── googleId, facebookId: string | null (unique)                │
│  ├── authProvider: LOCAL | GOOGLE | FACEBOOK                     │
│  ├── isAdmin: boolean                                            │
│  ├── status: PENDING | ACTIVE | SUSPENDED | BANNED               │
│  ├── createdAt, updatedAt                                        │
│  └── (derived) hasClientProfile, hasProfessionalProfile,         │
│                hasCompanyProfile                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        PROFILES CONTEXT                          │
├─────────────────────────────────────────────────────────────────┤
│  Client (clients)               Trade (trades)                   │
│  ├── id: UUID                   ├── id: UUID                     │
│  ├── userId: FK → User (unique) ├── name: string (unique)        │
│  ├── preferences: Json | null   ├── category: string | null      │
│  ├── savedProfessionals: str[]  ├── description: string | null   │
│  ├── searchHistory: Json | null └── createdAt, updatedAt         │
│  ├── notificationSettings: Json                                  │
│  └── createdAt, updatedAt                                        │
│                                                                  │
│  ServiceProvider (service_providers)                             │
│  ├── id: UUID                                                    │
│  ├── type: PROFESSIONAL | COMPANY                                │
│  ├── averageRating: Float (default 0)                            │
│  ├── totalReviews: Int (default 0)                               │
│  └── createdAt, updatedAt                                        │
│                                                                  │
│  Professional (professionals)   Company (companies)              │
│  ├── id: UUID                   ├── id: UUID                     │
│  ├── userId: FK (unique)        ├── userId: FK (unique)          │
│  ├── serviceProviderId (unique) ├── serviceProviderId (unique)   │
│  ├── description: str | null    ├── companyName: string          │
│  ├── experienceYears: int|null  ├── legalName: string | null     │
│  ├── status: ProfessionalStatus ├── taxId (CUIT): str | null,    │
│  ├── zone: string | null        │     unique                     │
│  ├── city: string ("Bariloche") ├── description: string | null   │
│  ├── address: string | null     ├── foundedYear: int | null      │
│  ├── website: string | null     ├── employeeCount: "1-5" | "6-20"│
│  ├── profileImage: str | null   │     | "21-50" | "50+" | null   │
│  ├── gallery: string[]          ├── website: string | null       │
│  ├── trades: ProfessionalTrade[]├── address: string | null       │
│  │     (tradeId, isPrimary)     ├── city: string ("Bariloche")   │
│  └── createdAt, updatedAt       ├── zone: string | null          │
│                                 ├── status: CompanyStatus        │
│  ProfessionalTrade / CompanyTrade├── profileImage: str | null    │
│  ├── id, professionalId|companyId├── gallery: string[]           │
│  ├── tradeId, isPrimary         ├── trades: CompanyTrade[]       │
│  └── unique (owner, tradeId)    └── createdAt, updatedAt         │
│                                                                  │
│  No `active` boolean, no phone/email/whatsapp on profiles.       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        REQUESTS CONTEXT                          │
├─────────────────────────────────────────────────────────────────┤
│  Request (requests)                                              │
│  ├── id: UUID                                                    │
│  ├── clientId: FK → User                                         │
│  ├── providerId: FK → ServiceProvider | null                     │
│  ├── tradeId: FK → Trade | null                                  │
│  ├── isPublic: boolean (default false)                           │
│  ├── title: string (default "")                                  │
│  ├── description: string                                         │
│  ├── address, availability: string | null                        │
│  ├── photos: string[] (default [])                               │
│  ├── status: PENDING | ACCEPTED | IN_PROGRESS | DONE | CANCELLED │
│  ├── quoteAmount: Float | null, quoteNotes: string | null        │
│  ├── clientRating: Int | null, clientRatingComment: str | null   │
│  │     (provider rates the client after DONE, once)              │
│  └── createdAt, updatedAt                                        │
│                                                                  │
│  RequestInterest (request_interests) - association store         │
│  ├── id: UUID                                                    │
│  ├── requestId: FK → Request                                     │
│  ├── serviceProviderId: FK → ServiceProvider                     │
│  ├── message: string | null                                      │
│  ├── createdAt                                                   │
│  └── unique (requestId, serviceProviderId)                       │
│                                                                  │
│  RequestInteraction (request_interactions)                       │
│  ├── id: UUID                                                    │
│  ├── requestId: FK → Request                                     │
│  ├── interactionType: FOLLOW_UP | RESPONSE | STATUS_UPDATE       │
│  ├── status: PENDING | SENT | DELIVERED | RESPONDED | FAILED     │
│  ├── direction: TO_CLIENT | TO_PROVIDER                          │
│  ├── channel: string (default "WHATSAPP")                        │
│  ├── messageTemplate, messageContent: string                     │
│  ├── responseContent: string | null                              │
│  ├── responseIntent: CONFIRMED | STARTED | COMPLETED | CANCELLED │
│  │                   | NEEDS_INFO | UNKNOWN | null               │
│  ├── scheduledFor: DateTime                                      │
│  ├── sentAt, deliveredAt, respondedAt: DateTime | null           │
│  ├── twilioMessageSid: string | null (unique), twilioStatus      │
│  ├── metadata: Json | null                                       │
│  └── createdAt, updatedAt                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       REPUTATION CONTEXT                         │
├─────────────────────────────────────────────────────────────────┤
│  Review (reviews)                                                │
│  ├── id: UUID                                                    │
│  ├── reviewerId: FK → User                                       │
│  ├── serviceProviderId: FK → ServiceProvider                     │
│  ├── requestId: FK → Request (unique)                            │
│  ├── rating: 1-5                                                 │
│  ├── comment: string | null                                      │
│  ├── status: PENDING | APPROVED | REJECTED                       │
│  ├── moderatedAt: DateTime | null, moderatedBy: FK → User | null │
│  └── createdAt, updatedAt                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     NOTIFICATIONS CONTEXT                        │
├─────────────────────────────────────────────────────────────────┤
│  Notification (notifications)                                    │
│  ├── id: UUID                                                    │
│  ├── userId: FK → User                                           │
│  ├── type: string (REQUEST_STATUS_CHANGED | ...)                 │
│  ├── title: string, body: string | null, data: Json | null       │
│  ├── idempotencyKey: string | null (unique)                      │
│  ├── createdAt                                                   │
│  └── deliveries: NotificationDelivery[]                          │
│                                                                  │
│  NotificationDelivery (notification_deliveries)                  │
│  ├── id: UUID, notificationId: FK → Notification                 │
│  ├── channel: IN_APP | EMAIL | WHATSAPP                          │
│  ├── status: PENDING | SENT | FAILED | SKIPPED                   │
│  ├── providerMessageId, errorCode, errorMessage: string | null   │
│  ├── attemptCount: Int, lastAttemptAt, nextAttemptAt             │
│  ├── sentAt, readAt: DateTime | null (readAt only for IN_APP)    │
│  ├── createdAt, updatedAt                                        │
│  └── unique (notificationId, channel)                            │
│                                                                  │
│  NotificationPreferences (notification_preferences)              │
│  ├── id: UUID, userId: FK → User (unique)                        │
│  ├── inAppEnabled: boolean (true), externalEnabled: boolean (true)│
│  ├── preferredExternalChannel: EMAIL | WHATSAPP (default EMAIL)  │
│  ├── overrides: Json | null  (per-type overrides)                │
│  └── createdAt, updatedAt                                        │
│                                                                  │
│  InAppNotification (in_app_notifications) - LEGACY               │
│  ├── id, userId: FK → User, type, title, body, data              │
│  └── readAt: DateTime | null, createdAt                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        CONTACT CONTEXT                           │
├─────────────────────────────────────────────────────────────────┤
│  Contact (contacts) - append-only log                            │
│  ├── id: UUID                                                    │
│  ├── fromUserId: FK → User, toUserId: FK → User                  │
│  ├── contactType: string (default "whatsapp")                    │
│  ├── message: string | null                                      │
│  └── createdAt                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Machines

### Request

```
             client cancels (any non-terminal)
   ┌───────────────────────────────────────────────────┐
   │                                                   ▼
PENDING ──► ACCEPTED ──► IN_PROGRESS ──► DONE      CANCELLED
   ▲   assign /  │   provider       provider
   │   provider  │   starts         completes
   │   accepts   │
   └─────────────┘ client unassigns (ACCEPTED → PENDING, providerId = null)
```

- Direct request: created `PENDING` with `providerId`; the assigned provider moves it to `ACCEPTED`.
- Public request: created `PENDING` with `tradeId` and no provider; providers add `RequestInterest`; the client
  assigns one (`providerId` set, status `ACCEPTED`; interest rows are kept as history).
- Provider-only transitions: `PENDING -> ACCEPTED`, `ACCEPTED -> IN_PROGRESS`, `IN_PROGRESS -> DONE`.
- Client-only transitions: `* -> CANCELLED` (except from `DONE`/`CANCELLED`), unassign (`ACCEPTED -> PENDING`).
- Admins may perform any transition.
- After `DONE`: the client may write one `Review`; the provider may rate the client once
  (`clientRating`, `clientRatingComment`).

### RequestInteraction (WhatsApp follow-up)

```
PENDING ──markAsSent──► SENT ──markAsDelivered──► DELIVERED ──markAsResponded──► RESPONDED
   │                     │                           │
   └──────markAsFailed───┴───────────────────────────┘──► FAILED
```

- `PENDING -> SENT`: `WhatsAppDispatchJob` sends via Twilio and stores `twilioMessageSid`.
- `SENT -> DELIVERED`: Twilio status callback (`MessageStatusCheckerJob` also polls `SENT` messages).
- `SENT | DELIVERED -> RESPONDED`: inbound message matched to the most recent interaction for that phone;
  `DetectResponseIntentUseCase` sets `responseIntent`; `requests.interaction.responded` is emitted.
- Any non-terminal -> `FAILED` (send error, max retries). `RESPONDED` and `FAILED` are terminal.

**Follow-up rules** (`FollowUpSchedulerJob`, hourly, 9-20h Buenos Aires): data-driven ladders in
`follow-up-ladders.ts` (initial message + reminders, max 3 per state and recipient). See
`docs/guides/whatsapp/README.md` for the full table (templates A1-A7 `notice_*`, P1-P3 `question_*`).

**Reply -> Request status** (`RequestInteractionRespondedHandler`; only the question templates move state,
the template being answered disambiguates the generic `responseIntent`):

| Template answered | Current status | `responseIntent` | New status |
|-------------------|----------------|------------------|-----------|
| `question_agreement` (P1) | `CONTACT_RELEASED` | `CONFIRMED`/`STARTED` | `IN_PROGRESS` |
| `question_agreement` (P1) | `CONTACT_RELEASED` | `CANCELLED` | `NOT_COMPLETED` (reply stored in `statusReason`) |
| `question_progress` (P2) | `IN_PROGRESS` | `COMPLETED` | `FINISHED` |
| `question_progress` (P2) | `IN_PROGRESS` | `CANCELLED` (not a bare "no") | `INTERRUPTED` (reply stored in `statusReason`) |
| `question_satisfaction` (P3) | `FINISHED` | `CONFIRMED` | `CLOSED` |
| `question_satisfaction` (P3) | `FINISHED` | `CANCELLED` | `UNDER_REVIEW` |
| any | any | `NEEDS_INFO`, `UNKNOWN`, or reply to a notice | no change |

A `STATUS_UPDATE` interaction (`status_update_*` template) is sent back after every automatic transition.

### Review

```
PENDING ──approve (admin)──► APPROVED   (recalculates ServiceProvider rating, emits reputation.review.approved)
   │
   └─────reject (admin)───► REJECTED
```

Reviewer can edit only while `PENDING`; only `APPROVED` reviews are visible to everyone else.

### NotificationDelivery

```
PENDING ──► SENT
   │
   ├──► FAILED   (after NOTIFICATIONS_DISPATCH_MAX_ATTEMPTS, exponential backoff via nextAttemptAt)
   └──► SKIPPED  (written at creation for the non-preferred external channel, or when external is disabled)
```

---

## Profile Activation ("active profile")

A user may hold a **Client** profile and, independently, **one or both** provider profiles
(`Professional`, `Company`). Provider profiles are mutually exclusive at operation time:

**Rule (XOR, `ProfileActivationPolicy`)**: at most one provider profile per user may be in an operable state
(`ACTIVE | VERIFIED`). Activating one sets the other to `INACTIVE`.

- `resolveActivation(target, professional, company)`: refuses `REJECTED`/`SUSPENDED` targets; a
  `PENDING_VERIFICATION` company cannot self-activate (admin must verify); a `PENDING_VERIFICATION` professional
  may self-activate (MVP). If the other profile `canOperate()`, it is deactivated.
- `resolveCompanyVerification(professional, company)`: admin verification of a `PENDING_VERIFICATION` company
  sets it `ACTIVE` and deactivates an operating professional.
- `getActiveProfile()`: Company wins if both somehow operate.
- Applied by `ProfileToggleService` (`activateProfessionalProfile`, `activateCompanyProfile`,
  `handleCompanyVerification`) via `updateStatus` on both repositories.

**Definition of "active" (`ProfileActivationService.getActivationStatus(userId)`)** - the single orchestration
point; other modules read its result instead of recomputing it:

| Flag | Formula |
|------|---------|
| `hasActiveClientProfile` | `user.hasClientProfile && user.isFullyVerified()` |
| `hasActiveProviderProfile` | `(professional.canOperate() \|\| company.canOperate()) && user.isFullyVerified()` |
| `activeServiceProviderId` | `serviceProviderId` of the operating profile, or `null` |

where `canOperate()` = `status === ACTIVE || status === VERIFIED` (profile only) and `isFullyVerified()` =
`emailVerified && phoneVerified` (user only). These flags feed `RequestAuthContext`
(`hasActiveClientProfile`, `hasActiveProviderProfile`, `serviceProviderId`) used by `RequestEntity`
(`canExpressInterestBy`, `canAssignProviderBy`). The public catalogue (`GET /providers`) lists only profiles
that `canOperate()` **and** whose user is fully verified.

---

## Business Rules

### Identity
- Email must be unique; OAuth users have no password and start with `emailVerified = true`.
- `User.status` defaults to `PENDING`; only `ACTIVE` users can operate.
- Changing `email` or `phone` resets the corresponding `*Verified` flag.
- Admins can override verification flags manually (`PUT /admin/users/:id/verification`).

### Profiles
- Every `Professional` / `Company` owns exactly one `ServiceProvider` (`serviceProviderId @unique`).
- Provider must have at least one Trade; at most one `isPrimary`.
- `Company.taxId` (CUIT) is unique when provided; company verification is manual (admin).
- Operability is derived from `status` only (`ACTIVE | VERIFIED`); there is no `active` flag.
- Contact data comes from `User` (`phone`, `email`); profiles carry `website`, `address`, `city`, `zone`.
- Only one provider profile per user may operate at a time (see Profile Activation).

### Requests
- Direct request: `providerId` required, `tradeId` optional. Public request: `tradeId` required,
  `providerId` null until assignment.
- Creating a request requires `hasActiveClientProfile`; expressing interest requires
  `hasActiveProviderProfile` and a public `PENDING` request without provider.
- `RequestInterest` is added/removed, never updated: one per `(requestId, serviceProviderId)`.
- Only the client (or admin) assigns/unassigns and cancels; only the assigned provider advances status.
- The provider may rate the client once after `DONE`.
- `RequestInteraction` transitions are enforced in the entity (`markAsSent` requires `PENDING`, etc.);
  `twilioMessageSid` is unique.

### Reputation
- Review only when `Request.status = DONE`; one Review per Request; rating 1..5.
- New reviews are `PENDING`; only admins moderate; only `APPROVED` reviews affect
  `ServiceProvider.averageRating` / `totalReviews`.
- Reviews are attached to the `ServiceProvider`, so Professional and Company histories never merge.

### Notifications
- One `Notification` per (user, event); `idempotencyKey` prevents duplicates.
- One `NotificationDelivery` per channel: `IN_APP` when `inAppEnabled`; the preferred external channel is
  created `PENDING` when `externalEnabled`, the other external channel is written as `SKIPPED` (per-type
  `overrides` apply).
- External deliveries are retried with exponential backoff, then marked `FAILED`; admins can `markForResend`.
- Recipients are resolved through `providerUserId` in the event payload (works for both provider types).

### Contact
- `Contact` rows are written once and only queried (`findByUserId`); never updated.

---

## Deprecated / Compatibility Notes

- `professionalId` on `Request`, `RequestInterest`, `Review` and on event payloads is a **getter alias** for
  `providerId` / `serviceProviderId` kept for backward compatibility. New code must use the ServiceProvider ids.
- `InAppNotification` (`in_app_notifications`) is legacy; read/unread now lives in
  `NotificationDelivery.readAt` (`IN_APP` channel).
- `ProfessionalRepository.updateStatus`, `CompanyRepository.updateStatus` and `*.updateRating` are narrow
  write paths that predate the pure `save` contract; they are the only sanctioned non-`save` mutations.
- `docs/architecture/COMPANY_PROFILES.md` and ADR-004 predate `PENDING_VERIFICATION | INACTIVE | REJECTED`
  and the `totalReviews` naming; this document and the schema are authoritative.

---

## Module Structure

```
src/
├── identity/           # User, auth (local + OAuth), verification, UserQueryRepository
├── profiles/           # Client, Professional, Company, ServiceProvider, Trade,
│                       # ProfileActivationPolicy, ProfileToggleService, ProfileActivationService
├── requests/           # Request, RequestInterest, RequestInteraction, follow-up rules,
│                       # WhatsApp jobs (scheduler, dispatch, status checker), Twilio webhook
├── reputation/         # Review, moderation, rating recalculation
├── notifications/      # Notification, NotificationDelivery, NotificationPreferences,
│                       # InAppNotification (legacy), dispatch/retention jobs, event handlers
├── contact/            # Contact append-only log
├── storage/            # File upload/serving (FileStoragePort, no Prisma model)
├── admin/              # Admin read models and moderation endpoints
├── health/             # Health checks
└── shared/             # EventBus, DomainEvent, PrismaService, messaging templates
```

---

*Last Updated: September 2026*
