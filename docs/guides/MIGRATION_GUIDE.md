# Migration Guide

> Guide for database migrations using Prisma ORM.

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Prisma CLI (`npm install -D prisma`)

## Environment Setup

Create a `.env` file with your database connection:

```env
# Local development
DATABASE_URL="postgresql://user:password@localhost:5432/specialist?schema=public"

# Supabase (production)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres?pgbouncer=true"
```

## Common Commands

### Generate Prisma Client

After modifying `schema.prisma`:

```bash
npx prisma generate
```

### Create a New Migration

```bash
npx prisma migrate dev --name <migration_name>
```

Examples:
```bash
npx prisma migrate dev --name add_user_phone
npx prisma migrate dev --name create_request_interest_table
```

### Apply Migrations (Production)

```bash
npx prisma migrate deploy
```

### Reset Database (Development Only)

⚠️ **Warning**: This will delete all data!

```bash
npx prisma migrate reset
```

### View Database

```bash
npx prisma studio
```

## Migration Workflow

### 1. Development

```bash
# 1. Edit prisma/schema.prisma
# 2. Create migration
npx prisma migrate dev --name your_change_description

# 3. Test locally
npm run start:dev
```

### 2. Production (Fly.io)

```bash
# Option A: Manual (one-time)
fly ssh console
cd /app
npx prisma migrate deploy

# Option B: Via local connection
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### 3. Supabase Direct Connection

For migrations, use the direct connection (port 5432), not the pooler:

```bash
# Direct connection for migrations
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" npx prisma migrate deploy
```

## Seeding Data

### Run Seed

```bash
npx prisma db seed
```

### Seed File Location

```
prisma/seed.ts
```

### Configure Seed in package.json

```json
{
  "prisma": {
    "seed": "ts-node --transpile-only prisma/seed.ts"
  }
}
```

## Troubleshooting

### Error: "Database schema is not empty"

The database has existing tables. Options:

1. **Reset** (dev only): `npx prisma migrate reset`
2. **Baseline**: Mark existing schema as migrated
   ```bash
   npx prisma migrate resolve --applied <migration_name>
   ```

### Error: "Migration not found"

Migrations in `prisma/migrations/` don't match the database. Options:

1. Reset the database (dev only)
2. Manually sync the `_prisma_migrations` table

### Error: "Can't reach database server"

1. Check `DATABASE_URL` is correct
2. For Supabase: use direct connection (5432), not pooler (6543)
3. Check firewall/network settings

### PgBouncer Issues

If using Supabase with connection pooling:

```env
# For normal operations (with pooler)
DATABASE_URL="postgresql://...@db.[PROJECT].supabase.co:6543/postgres?pgbouncer=true"

# For migrations (direct connection)
DIRECT_URL="postgresql://...@db.[PROJECT].supabase.co:5432/postgres"
```

In `schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## Current Schema

See `prisma/schema.prisma` for the current database schema.

Main models:
- `User` - User accounts
- `Client` - Client profiles
- `Professional` - Professional profiles
- `Trade` - Service categories
- `ProfessionalTrade` - Professional-Trade relationship
- `Request` - Service requests
- `RequestInterest` - Professional interests in public requests
- `Review` - Reviews and ratings
- `File` - Uploaded files
- `Contact` - Contact requests

---

*Last Updated: December 2024*
