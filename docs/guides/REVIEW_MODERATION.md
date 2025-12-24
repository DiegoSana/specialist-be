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
  "professionalId": "uuid",
  "requestId": "uuid",
  "rating": 5,
  "comment": "Excellent work!"
}
```

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

**Effects:**
- Sets `status` to `APPROVED`
- Sets `moderatedAt` timestamp
- Sets `moderatedBy` to admin user ID
- Recalculates professional's average rating
- Sends notification to the professional

### Reject Review (Admin)
```http
POST /api/reviews/:id/reject
Authorization: Bearer <admin-token>
```

**Effects:**
- Sets `status` to `REJECTED`
- Sets `moderatedAt` timestamp
- Sets `moderatedBy` to admin user ID
- Recalculates professional's rating (excludes this review)
- No notification sent

---

## Rating Calculation

Only `APPROVED` reviews are considered for:
- Professional's average rating (`averageRating`)
- Review count (`reviewCount`)
- Public review listings

```typescript
// Only approved reviews count
const approvedReviews = await reviewRepository.findApprovedByProfessionalId(id);
const avgRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;
```

---

## Public Visibility

### What clients see:
- Only `APPROVED` reviews on professional profiles
- Rating based only on approved reviews

### What professionals see:
- Their own approved reviews
- Notification when a review is approved

### What admins see:
- All reviews with all statuses
- Moderation queue with pending reviews

---

## Database Schema

```prisma
enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

model Review {
  id             String       @id @default(uuid())
  reviewerId     String
  professionalId String
  requestId      String?      @unique
  rating         Int
  comment        String?
  status         ReviewStatus @default(PENDING)
  moderatedAt    DateTime?
  moderatedBy    String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  professional   Professional @relation(...)
  reviewer       User         @relation("Reviewer", ...)
  moderator      User?        @relation("Moderator", ...)
}
```

---

## Notifications

When a review is approved, the professional receives:
- **In-app notification**: Visible in notification bell
- **Email notification**: If external notifications are enabled

```typescript
// ReviewApprovedEvent triggers notification
{
  type: 'REVIEW_APPROVED',
  title: '¡Tenés una nueva reseña!',
  data: { reviewId, professionalId }
}
```

