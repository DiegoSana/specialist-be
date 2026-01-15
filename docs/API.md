# Specialist API Documentation

> **Base URL**: `/api`  
> **Swagger UI**: `/api/docs` (when running locally)  
> **Version**: 1.0.0

## Overview

The API is organized around REST principles and follows a bounded context architecture:

| Context | Prefix | Description |
|---------|--------|-------------|
| **Identity** | `/auth`, `/users` | Authentication & user management |
| **Profiles** | `/professionals`, `/companies`, `/trades` | Service provider profiles (individual & company) |
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
- `GET /companies` (search)
- `GET /companies/:id`
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

### 👷 Profiles - Professionals (`/professionals`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/professionals` | Search professionals | ❌ |
| `GET` | `/professionals/:id` | Get professional details | ❌ |
| `GET` | `/professionals/me/profile` | Get my professional profile | ✅ |
| `POST` | `/professionals/me` | Create professional profile | ✅ |
| `PATCH` | `/professionals/me` | Update professional profile | ✅ |
| `POST` | `/professionals/me/gallery` | Add gallery item | ✅ |
| `DELETE` | `/professionals/me/gallery` | Remove gallery item | ✅ |

### 🏢 Profiles - Companies (`/companies`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/companies` | Search companies (public) | ❌ |
| `GET` | `/companies/:id` | Get company details | ❌ |
| `GET` | `/companies/me/profile` | Get my company profile | ✅ |
| `POST` | `/companies/me` | Create company profile | ✅ |
| `PATCH` | `/companies/me` | Update company profile | ✅ |
| `POST` | `/companies/me/gallery` | Add gallery image | ✅ |
| `DELETE` | `/companies/me/gallery` | Remove gallery image | ✅ |
| `POST` | `/companies/:id/verify` | Verify company (Admin) | ✅ Admin |

> **Note**: Companies and Professionals are both "Service Providers". Both can express interest in public requests and be assigned to jobs. See [ADR-004-SERVICE-PROVIDER-ABSTRACTION](./decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md).

### 📦 Profiles - Trades (`/trades`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/trades` | List all trades | ❌ |
| `GET` | `/trades/:id` | Get trade by ID | ❌ |
| `GET` | `/trades/with-professionals` | Trades with active providers | ❌ |

### 📋 Requests (`/requests`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/requests` | Get my requests | ✅ |
| `POST` | `/requests` | Create new request | ✅ |
| `GET` | `/requests/available` | Available requests (for providers) | ✅ Provider |
| `GET` | `/requests/:id` | Get request details | ✅ |
| `PATCH` | `/requests/:id` | Update request (status, quote) | ✅ |
| `POST` | `/requests/:id/accept` | Accept quote (client) | ✅ |
| `POST` | `/requests/:id/photos` | Add photo to request | ✅ |
| `DELETE` | `/requests/:id/photos` | Remove photo from request | ✅ |
| `POST` | `/requests/:id/interest` | Express interest (provider) | ✅ Provider |
| `DELETE` | `/requests/:id/interest` | Remove interest | ✅ Provider |
| `GET` | `/requests/:id/interest` | Check my interest status | ✅ Provider |
| `GET` | `/requests/:id/interests` | List interested providers | ✅ |
| `POST` | `/requests/:id/assign` | Assign provider (client) | ✅ |

> **Note**: "Provider" = Professional or Company. Both can view available requests, express interest, and be assigned to jobs.

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

## Service Providers

The platform supports two types of service providers:

### Professional
An individual service provider with a personal profile.

```json
{
  "id": "uuid",
  "userId": "uuid",
  "serviceProviderId": "uuid",
  "displayName": "Juan Pérez",
  "city": "Bariloche",
  "status": "ACTIVE",
  "trades": [{ "tradeId": "uuid", "name": "Plomería", "isPrimary": true }],
  "averageRating": 4.5,
  "reviewCount": 12
}
```

### Company
A business entity providing services.

```json
{
  "id": "uuid",
  "userId": "uuid",
  "serviceProviderId": "uuid",
  "companyName": "Construcciones Patagonia S.A.",
  "legalName": "Construcciones Patagonia S.A.",
  "taxId": "30-12345678-9",
  "city": "Bariloche",
  "status": "ACTIVE",
  "trades": [{ "tradeId": "uuid", "name": "Construcción", "isPrimary": true }],
  "averageRating": 4.8,
  "reviewCount": 45
}
```

### Company Status

| Status | Description |
|--------|-------------|
| `PENDING` | Newly created, awaiting activation |
| `ACTIVE` | Active and can operate |
| `VERIFIED` | Verified by admin (badge displayed) |
| `SUSPENDED` | Temporarily suspended |

---

## Request Types

### Direct Request
A request sent directly to a specific service provider.

```json
{
  "isPublic": false,
  "professionalId": "uuid",
  "description": "Need help with...",
  "address": "Address 123"
}
```

### Public Request (Job Board)
A request visible to all service providers in a trade.

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

## Interest Flow

When a public request is created, service providers (professionals or companies) can express interest:

1. **Client** creates a public request
2. **Providers** view available requests via `GET /requests/available`
3. **Provider** expresses interest via `POST /requests/:id/interest`
4. **Client** views interested providers via `GET /requests/:id/interests`
5. **Client** assigns a provider via `POST /requests/:id/assign`

```json
// Express interest request
{
  "message": "Estoy interesado en este trabajo. Tengo 10 años de experiencia."
}

// Interested provider response
{
  "serviceProviderId": "uuid",
  "providerType": "PROFESSIONAL", // or "COMPANY"
  "displayName": "Juan Pérez",
  "message": "...",
  "averageRating": 4.5,
  "reviewCount": 12
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

