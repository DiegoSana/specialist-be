# Specialist API Documentation

> **Base URL**: `/api`  
> **Swagger UI**: `/api/docs` (when running locally)  
> **Version**: 1.0.0

## Overview

The API is organized around REST principles and follows a bounded context architecture:

| Context | Prefix | Description |
|---------|--------|-------------|
| **Identity** | `/auth`, `/users` | Authentication & user management |
| **Profiles** | `/professionals`, `/trades` | Professional profiles & trades catalog |
| **Requests** | `/requests` | Service requests & job matching |
| **Reputation** | `/reviews` | Reviews & ratings (with moderation) |
| **Notifications** | `/notifications` | In-app & external notifications |
| **Admin** | `/admin` | Administrative operations |
| **Storage** | `/storage` | File uploads & media |
| **Contact** | `/contact` | Contact requests |

---

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### Public Endpoints (no auth required)
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/google`, `GET /auth/facebook` (OAuth)
- `GET /professionals` (search)
- `GET /professionals/:id`
- `GET /trades`
- `GET /professionals/:id/reviews`

---

## Endpoints by Context

### 🔐 Identity (`/auth`, `/users`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/register` | Register new user | ❌ |
| `POST` | `/auth/login` | Login with email/password | ❌ |
| `GET` | `/auth/google` | Initiate Google OAuth | ❌ |
| `GET` | `/auth/facebook` | Initiate Facebook OAuth | ❌ |
| `GET` | `/users/me` | Get current user profile | ✅ |
| `PATCH` | `/users/me` | Update current user profile | ✅ |
| `POST` | `/users/me/client-profile` | Activate client profile | ✅ |

### 👷 Profiles (`/professionals`, `/trades`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/professionals` | Search professionals | ❌ |
| `GET` | `/professionals/:id` | Get professional details | ❌ |
| `GET` | `/professionals/me/profile` | Get my professional profile | ✅ |
| `POST` | `/professionals/me` | Create professional profile | ✅ |
| `PATCH` | `/professionals/me` | Update professional profile | ✅ |
| `POST` | `/professionals/me/gallery` | Add gallery item | ✅ |
| `DELETE` | `/professionals/me/gallery` | Remove gallery item | ✅ |
| `GET` | `/trades` | List all trades | ❌ |
| `GET` | `/trades/:id` | Get trade by ID | ❌ |
| `GET` | `/trades/with-professionals` | Trades with active professionals | ❌ |

### 📋 Requests (`/requests`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/requests` | Get my requests | ✅ |
| `POST` | `/requests` | Create new request | ✅ |
| `GET` | `/requests/available` | Available requests (for professionals) | ✅ |
| `GET` | `/requests/:id` | Get request details | ✅ |
| `PATCH` | `/requests/:id` | Update request (status, quote) | ✅ |
| `POST` | `/requests/:id/accept` | Accept quote (client) | ✅ |
| `POST` | `/requests/:id/photos` | Add photo to request | ✅ |
| `DELETE` | `/requests/:id/photos` | Remove photo from request | ✅ |
| `POST` | `/requests/:id/interest` | Express interest (professional) | ✅ |
| `DELETE` | `/requests/:id/interest` | Remove interest | ✅ |
| `GET` | `/requests/:id/interest` | Check my interest status | ✅ |
| `GET` | `/requests/:id/interests` | List interested professionals | ✅ |
| `POST` | `/requests/:id/assign` | Assign professional (client) | ✅ |

### ⭐ Reputation (`/reviews`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/reviews` | Create review (status: PENDING) | ✅ |
| `GET` | `/reviews?requestId=xxx` | Get review by request | ✅ |
| `GET` | `/reviews/:id` | Get review by ID | ✅ |
| `PATCH` | `/reviews/:id` | Update review | ✅ |
| `DELETE` | `/reviews/:id` | Delete review | ✅ |
| `GET` | `/professionals/:id/reviews` | Get professional's approved reviews | ❌ |
| `GET` | `/reviews/admin/pending` | Get pending reviews (Admin) | ✅ Admin |
| `POST` | `/reviews/:id/approve` | Approve review (Admin) | ✅ Admin |
| `POST` | `/reviews/:id/reject` | Reject review (Admin) | ✅ Admin |

> **Note**: Reviews are moderated. New reviews have `PENDING` status and only `APPROVED` reviews are visible publicly and count towards the professional's rating. See [Review Moderation Guide](./guides/REVIEW_MODERATION.md).

### 🔔 Notifications (`/notifications`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/notifications` | List my notifications | ✅ |
| `PATCH` | `/notifications/:id/read` | Mark notification as read | ✅ |
| `PATCH` | `/notifications/read-all` | Mark all as read | ✅ |
| `GET` | `/notifications/preferences` | Get my notification preferences | ✅ |
| `PUT` | `/notifications/preferences` | Update my preferences | ✅ |

> See [Notifications Guide](./guides/NOTIFICATIONS.md) for email configuration and event types.

### 🔧 Admin (`/admin`)

> All admin endpoints require `isAdmin: true` in the JWT token.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/users` | List all users |
| `GET` | `/admin/users/:id` | Get user by ID |
| `PUT` | `/admin/users/:id/status` | Update user status |
| `GET` | `/admin/professionals` | List all professionals |
| `PUT` | `/admin/professionals/:id/status` | Update professional status |

### 📁 Storage (`/storage`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/storage/upload` | Upload file | ✅ |
| `GET` | `/storage/public/*` | Get public file | ❌ |
| `GET` | `/storage/private/*` | Get private file | ✅ |
| `DELETE` | `/storage/*` | Delete file | ✅ |

### 📞 Contact (`/contact`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/contact` | Create contact request | ✅ |
| `GET` | `/contact` | Get my contacts | ✅ |

### ❤️ Health (`/health`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Basic health check |
| `GET` | `/health/ready` | Readiness check |
| `GET` | `/health/live` | Liveness check |

---

## Common Response Formats

### Success Response
```json
{
  "id": "uuid",
  "field": "value",
  ...
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### Paginated Response
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

## Request Types

### Direct Request
A request sent directly to a specific professional.

```json
{
  "isPublic": false,
  "professionalId": "uuid",
  "description": "Need help with...",
  "address": "Address 123"
}
```

### Public Request
A request visible to all professionals in a trade.

```json
{
  "isPublic": true,
  "tradeId": "uuid",
  "description": "Looking for...",
  "city": "Bariloche",
  "zone": "Centro"
}
```

---

## Request Status Flow

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────┐
│ PENDING │ ──► │ ACCEPTED │ ──► │IN_PROGRESS│ ──► │ DONE │
└─────────┘     └──────────┘     └──────────┘     └──────┘
     │                                                 │
     │              ┌───────────┐                      │
     └────────────► │ CANCELLED │ ◄────────────────────┘
                    └───────────┘
```

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding for production.

---

## CORS

Configured origins are set via `CORS_ORIGINS` environment variable.

---

## For More Details

Visit the Swagger documentation at `/api/docs` when the server is running.

