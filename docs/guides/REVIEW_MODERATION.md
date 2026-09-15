# Review Moderation

## Overview

All reviews go through a moderation process before being publicly visible. This ensures quality and prevents abuse.

## Review Status Flow

```
┌─────────┐     ┌──────────┐
│ PENDING │ ──► │ APPROVED │ ──► Visible publicly, counts in rating
└─────────┘     └──────────┘
     │
     │          ┌──────────┐
     └────────► │ REJECTED │ ──► Hidden, does not count in rating
                └──────────┘
```

## Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting moderation (default for new reviews) |
| `APPROVED` | Visible publicly, included in rating calculation |
| `REJECTED` | Hidden from public, excluded from rating |

---

## API Endpoints

### Create Review
Reviews are created with `PENDING` status:

```http
POST /api/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "requestId": "uuid",
  "rating": 5,
  "comment": "Excellent work!",
  "professionalId": "uuid"
}
```

Rules enforced by `ReviewService.create`:
- The caller must have a client profile (`hasClientProfile`).
- `requestId` is required (the DTO still marks it optional, the service rejects it if missing). The request must belong to the caller, be reviewable (completed) and have an assigned provider.
- The reviewed provider is **always the request's assigned `ServiceProvider`** (`request.providerId`). `professionalId` in the body is legacy and ignored.
- One review per request (`409 Conflict` otherwise).
- The provider rating is **not** updated at creation time.

While a review is `PENDING`, the reviewer can edit or delete it (`PATCH /api/reviews/:id`, `DELETE /api/reviews/:id`); once moderated it is frozen.

### Get Pending Reviews (Admin)
```http
GET /api/reviews/admin/pending
Authorization: Bearer <admin-token>
```

### Approve Review (Admin)
```http
POST /api/reviews/:id/approve
Authorization: Bearer <admin-token>
```

Only `PENDING` reviews can be moderated (`400` otherwise). Both endpoints are guarded by `JwtAuthGuard + AdminGuard` and re-checked in the domain (`ReviewEntity.canBeModeratedBy`).

**Effects:**
- Sets `status` to `APPROVED`
- Sets `moderatedAt` timestamp
- Sets `moderatedBy` to admin user ID
- Recalculates the provider's rating from approved reviews (`ReviewService.updateServiceProviderRating`). Today this is only persisted for **Professional** providers via `ProfessionalService.updateRating`; Company providers are skipped (`TODO` in code, `CompanyService.updateRating` exists but is not wired yet)
- Publishes `ReviewApprovedEvent`, which notifies the provider's user (Professional or Company)

### Reject Review (Admin)
```http
POST /api/reviews/:id/reject
Authorization: Bearer <admin-token>
```

**Effects:**
- Sets `status` to `REJECTED`
- Sets `moderatedAt` timestamp
- Sets `moderatedBy` to admin user ID
- No rating recalculation (a pending review was never counted)
- No notification sent

---

## Rating Calculation

Only `APPROVED` reviews are considered for:
- Provider's average rating (`ServiceProvider.averageRating`)
- Review count (`ServiceProvider.totalReviews`)
- Public review listings

```typescript
// Only approved reviews count (ReviewService.updateServiceProviderRating)
const approved = await reviewRepository.findApprovedByServiceProviderId(serviceProviderId);
const averageRating = approved.reduce((sum, r) => sum + r.rating, 0) / approved.length;
await professionalService.updateRating(professional.id, averageRating, approved.length);
```

Recalculation runs on approve and on delete. Only the reviewer can delete, and only while `PENDING` (`ReviewEntity.canBeModifiedBy`), so the delete-time recomputation is defensive and normally a no-op.

---

## Public Visibility

### Public endpoint
```http
GET /api/professionals/:professionalId/reviews   # @Public(), APPROVED only
```
It resolves the professional's `serviceProviderId` and returns approved reviews as `PublicReviewDto`. There is no equivalent `/companies/:id/reviews` endpoint yet (`ReviewService.findByServiceProviderId` exists for it).

### What clients see:
- Only `APPROVED` reviews on provider profiles
- Rating based only on approved reviews
- Their own review in any status (`GET /api/reviews/:id`, `GET /api/reviews?requestId=`); `ReviewEntity.canBeViewedBy` allows pending/rejected only to the reviewer or an admin

### What providers see:
- Their approved reviews (public listing)
- Notification when a review is approved

### What admins see:
- All reviews with all statuses
- Moderation queue with pending reviews (`GET /api/reviews/admin/pending`)

---

## Database Schema

```prisma
enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

model Review {
  id                String       @id @default(uuid())
  reviewerId        String
  serviceProviderId String       // ServiceProvider being reviewed (Professional or Company)
  requestId         String       @unique // Review is always tied to a request
  rating            Int
  comment           String?
  status            ReviewStatus @default(PENDING)
  moderatedAt       DateTime?
  moderatedBy       String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  serviceProvider ServiceProvider @relation(fields: [serviceProviderId], references: [id], onDelete: Cascade)
  request         Request         @relation(fields: [requestId], references: [id])
  reviewer        User            @relation("Reviewer", fields: [reviewerId], references: [id], onDelete: Cascade)
  moderator       User?           @relation("Moderator", fields: [moderatedBy], references: [id])

  @@map("reviews")
}
```

Reviews point to the `ServiceProvider` aggregate (see [ADR-004](../decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md)), not to `Professional`, so Companies can be reviewed with the same model. `averageRating` / `totalReviews` live on `ServiceProvider`.

---

## Notifications

When a review is approved, `ReviewService.approve` publishes `ReviewApprovedEvent` with the provider's `userId` (resolved from the `serviceProviderId` via `ProfessionalService` or `CompanyService`). `ReviewsNotificationsHandler` (notifications module) then creates a notification for that user:
- **In-app notification**: Visible in notification bell
- **External notification** (email, or WhatsApp when preferred): If the user's external notifications are enabled (`includeExternal: true`)

```typescript
// ReviewsNotificationsHandler.onReviewApproved
{
  type: 'REVIEW_APPROVED',
  title: '¡Tenés una nueva reseña!',
  body: '⭐⭐⭐⭐⭐ - "first 100 chars of comment..."',
  data: { reviewId, serviceProviderId, providerType, rating, professionalId /* legacy */ },
  idempotencyKey: 'reputation.review.approved:<reviewId>',
}
```

See [NOTIFICATIONS.md](./NOTIFICATIONS.md) for channels and preferences.

