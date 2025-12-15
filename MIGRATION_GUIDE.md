# Migration Guide - DDD Refactoring

## Overview

The application has been refactored to follow **Domain-Driven Design (DDD)** principles with clear **bounded contexts**.

## New Structure

### Bounded Contexts

1. **User Management Context** (`src/user-management/`)
   - Manages user identity, authentication, and roles
   - Aggregate Root: `User`
   - Endpoints: `/api/auth/*`, `/api/users/*`

2. **Service Context** (`src/service/`)
   - Manages professionals, trades, and service requests
   - Aggregate Roots: `Professional`, `Trade`, `Request`
   - Endpoints: `/api/service/*`

3. **Reputation Context** (`src/reputation/`)
   - Manages reviews and ratings
   - Aggregate Root: `Review`
   - Endpoints: `/api/reputation/*`

4. **Contact Context** (`src/contact/`)
   - Manages contact requests between users
   - Endpoints: `/api/contact/*`

5. **Admin Context** (`src/admin/`)
   - Administrative functions
   - Endpoints: `/api/admin/*`

## Key Changes

### Database Schema

- **User** model now has a `role` enum: `CLIENT`, `PROFESSIONAL`, `ADMIN`
- **Professional** is now linked to `User` via `userId` (1:1 relationship)
- **Trade** model added for service categories
- **Request** model added for service requests
- **Review** can optionally link to a `Request`

### Domain Entities

All entities are now in their respective bounded contexts:
- `UserEntity` → `src/user-management/domain/entities/user.entity.ts`
- `ProfessionalEntity` → `src/service/domain/entities/professional.entity.ts`
- `TradeEntity` → `src/service/domain/entities/trade.entity.ts`
- `RequestEntity` → `src/service/domain/entities/request.entity.ts`
- `ReviewEntity` → `src/reputation/domain/entities/review.entity.ts`

### Repositories

Repository interfaces are in the domain layer, implementations in infrastructure:
- Example: `UserRepository` (interface) → `PrismaUserRepository` (implementation)
- All repositories use dependency injection tokens (e.g., `USER_REPOSITORY`)

### Authentication

- Authentication is now part of the **User Management Context**
- JWT payload includes `role` field
- `CurrentUser` decorator returns `UserEntity` with role methods

## Migration Steps

### First Time Setup

1. **Start Docker containers**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Wait for PostgreSQL to be ready** (5-10 seconds)

3. **Create initial migration**
   ```bash
   docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev --name init
   ```

4. **Verify migration status**
   ```bash
   docker-compose -f docker-compose.dev.yml exec app npx prisma migrate status
   ```

### Development Workflow

When making changes to `schema.prisma`:

```bash
# Create and apply new migration
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev --name descriptive_name
```

This will:
- Create a new migration
- Apply it automatically
- Regenerate Prisma Client

### Production Deployment

In production, only apply existing migrations:

```bash
docker-compose exec app npx prisma migrate deploy
```

## Prisma Configuration

### Binary Targets for Docker

The Prisma schema includes `binaryTargets` for Docker compatibility:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

- `native`: For local development (host OS)
- `linux-musl-openssl-3.0.x`: For Alpine Linux containers (Docker)

**Important**: After changing `binaryTargets`, regenerate Prisma Client:
```bash
npx prisma generate
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### User Management
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile

### Service
- `GET /api/service/trades` - List all trades
- `GET /api/service/trades/:id` - Get trade by ID
- `GET /api/service/professionals` - Search professionals
- `GET /api/service/professionals/:id` - Get professional details
- `GET /api/service/professionals/me/profile` - Get my professional profile
- `POST /api/service/professionals/me/profile` - Create professional profile
- `PUT /api/service/professionals/me/profile` - Update professional profile
- `POST /api/service/requests` - Create service request
- `GET /api/service/requests` - Get my requests
- `GET /api/service/requests/:id` - Get request by ID
- `PUT /api/service/requests/:id` - Update request status

### Reputation
- `GET /api/reputation/professionals/:id/reviews` - Get professional reviews
- `GET /api/reputation/reviews/:id` - Get review by ID
- `POST /api/reputation/reviews` - Create review
- `PUT /api/reputation/reviews/:id` - Update review
- `DELETE /api/reputation/reviews/:id` - Delete review

### Contact
- `POST /api/contact` - Create contact request
- `GET /api/contact` - Get my contacts

### Admin
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user by ID
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/professionals` - List all professionals
- `PUT /api/admin/professionals/:id/status` - Update professional status

## Common Commands

### View migration status
```bash
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate status
```

### Open Prisma Studio
```bash
docker-compose -f docker-compose.dev.yml exec app npx prisma studio
```
Then open http://localhost:5555 in your browser

### Reset database (⚠️ WARNING: deletes all data)
```bash
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate reset
```

### Regenerate Prisma Client
```bash
docker-compose -f docker-compose.dev.yml exec app npx prisma generate
```

## Troubleshooting

### Error: "Database schema is not in sync"

This means `schema.prisma` doesn't match the database. Solutions:

1. **If you're in development and don't mind losing data:**
   ```bash
   docker-compose -f docker-compose.dev.yml exec app npx prisma migrate reset
   ```

2. **If you want to create a migration to sync:**
   ```bash
   docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev --name sync_schema
   ```

### Error: "Migration X is in a failed state"

If a migration failed:

```bash
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate resolve --rolled-back X
```

Then try again.

### Error: "Prisma Client binary compatibility"

If you see errors about Prisma Client binaries:
- Ensure `binaryTargets` in `schema.prisma` includes `linux-musl-openssl-3.0.x`
- Regenerate Prisma Client: `npx prisma generate`

## Important Notes

- ✅ **Always** create migrations before making changes in production
- ✅ **Never** edit migrations that have already been applied
- ✅ **Always** test migrations in development first
- ❌ **Never** use `prisma db push` in production (only for quick prototyping)
