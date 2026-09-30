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

### Run seed (local o Supabase)

Desde la raíz del proyecto, el seed usa la `DATABASE_URL` de tu `.env`:

```bash
npx prisma db seed
```

### Run seed contra Supabase

1. **Obtener la connection string**  
   En Supabase: **Project Settings → Database**. Usa la **Connection string** (modo “URI”).  
   Para migraciones y seed conviene usar la **conexión directa** (puerto **5432**), no el pooler (6543).

2. **Configurar `DATABASE_URL`**  
   En tu `.env` (o solo para este comando):

   - **Recomendado (IPv4):** Connection string en **Session mode** (pooler), para evitar problemas si tu red no tiene IPv6:
     - Dashboard → **Project Settings → Database → Connect** → elegir **Session mode**
     - Host tipo `aws-0-[REGION].pooler.supabase.com`, puerto **5432**, usuario `postgres.[PROJECT_REF]`
     - Ejemplo: `postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`

   - **Alternativa (IPv6):** Conexión directa `db.[project-ref].supabase.co:5432` (solo si tu entorno tiene IPv6).

3. **Aplicar migraciones (si aún no está al día)**  
   Con la misma `DATABASE_URL`:

   ```bash
   npx prisma migrate deploy
   ```

4. **Ejecutar el seed**  
   Con la misma `DATABASE_URL`:

   ```bash
   npx prisma db seed
   ```

   Si preferís no tocar el `.env`, podés pasar la URL solo para este comando:

   ```bash
   DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" npx prisma db seed
   ```

**Nota:** El seed borra y recrea datos en las tablas que toca. Usalo en desarrollo/staging o en una copia de la base; en producción con datos reales conviene no ejecutarlo o hacer un backup antes.

### Seed file location

```
prisma/seed.ts
```

### Configure seed in package.json

El proyecto usa `tsx` para ejecutar el seed:

```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
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

### Error: "Migration not found" (P3015)

Migrations in `prisma/migrations/` don't match the database. Common cases:

1. **Orphan folder in container**: A migration folder exists on disk (e.g. inside Docker) but not in the repo (e.g. `20260121143414_add_phone_email_verification`). Prisma tries to load it and fails.
   - **Fix**: Remove the folder inside the container:  
     `docker exec -it <api-container> rm -rf /app/prisma/migrations/<orphan_folder_name>`
   - Then run `npx prisma migrate deploy` again.

2. **Orphan row in database**: The `_prisma_migrations` table has a row for a migration that no longer exists in the repo.
   - **Fix**: Delete the row, e.g.  
     `DELETE FROM "_prisma_migrations" WHERE migration_name = '...';`  
     (Use `scripts/fix-migration-record.sql` or run via `npx prisma db execute --file scripts/fix-migration-record.sql`.)

3. **Reset the database** (dev only): `npx prisma migrate reset`

### Error: "Can't reach database server"

1. Check `DATABASE_URL` is correct
2. **Supabase:** The direct connection (`db.xxx.supabase.co:5432`) uses **IPv6 only**. If your network doesn’t support IPv6, use the **Session mode pooler** instead (IPv4 compatible):
   - In Supabase Dashboard: **Project Settings → Database → Connect**
   - Choose **Session mode** (or “Connection string” and pick the pooler with port **5432** and host `aws-0-[REGION].pooler.supabase.com`)
   - User format: `postgres.[PROJECT_REF]` (e.g. `postgres.mheycpmaagmtpabtciks`)
   - Example: `postgresql://postgres.mheycpmaagmtpabtciks:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
3. Check firewall/network; if you use Supabase network restrictions, allow your IP (or temporarily allow all for testing)

### Error P3006: shadow database fails to apply an existing migration

`npx prisma migrate dev` replays every migration in `prisma/migrations/` **in filename order**
against a throwaway shadow database. `request_interactions` used to live in a folder named
`20250127000000_add_request_interactions`, which sorted *before* `20251215200251_init` (the migration
that creates the `requests` table it references), so replaying from empty failed with `P3006`/`P1014`.

It was renamed to `20251215200252_add_request_interactions`. Every already-migrated database must
have its `_prisma_migrations` row renamed **before** the next `migrate deploy`/`migrate dev`, or
Prisma reports the old name as missing (P3015) and tries to re-apply the new one:

```sql
-- UPDATE, not DELETE: keeps checksum and applied_at
UPDATE "_prisma_migrations"
SET migration_name = '20251215200252_add_request_interactions'
WHERE migration_name = '20250127000000_add_request_interactions';
```

Fresh databases need nothing. If you still see P3006 on a shadow DB, work around it by diffing
against the live database instead:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma db execute --file prisma/migrations/<timestamp>_<name>/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied <timestamp>_<name>
npx prisma migrate status   # should report "Database schema is up to date!"
npx prisma generate
```

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
- `User` - User accounts (email, phone, verification; contact for all profiles)
- `Client` - Client profiles
- `Professional` - Professional profiles (no `whatsapp`; contact = User.phone). Status only (no `active`).
- `Company` - Company profiles (no `phone`/`email`; contact = User). Status only (no `active`).
- `Trade` - Service categories
- `ProfessionalTrade` / `CompanyTrade` - Provider–Trade relationships
- `Request` - Service requests
- `RequestInterest` - Provider interests in public requests
- `Review` - Reviews and ratings
- `File` - Uploaded files
- `Contact` - Contact requests
- `RequestInteraction` - WhatsApp follow-up automation ledger (requests context)
- `RequestAttentionFlag` - requests needing admin attention (AT_RISK/ABANDONED/ESCALATED)
- `SupportConversation` / `SupportMessage` - general WhatsApp support channel (support context,
  independent of any Request; no FK on `SupportConversation.userId`/`relatedRequestId` - soft
  references, see `docs/decisions/ADR-005-SUPPORT-CONVERSATIONS.md`)

### Recent migration: profile contact and status (2026-02)

- **Professional**: removed `whatsapp`; contact = `User.phone`. Removed `active`; “can operate” = `status` in (ACTIVE, VERIFIED).
- **Company**: removed `phone`, `email`, `active`; contact = User; “can operate” = `status` in (ACTIVE, VERIFIED).
- Migration: `20260206000000_remove_profile_contact_and_active`.

### Recent migration: support context (2026-09)

- New tables `support_conversations` / `support_messages`, new enums
  `SupportConversationStatus` (`OPEN`/`RESOLVED`), `SupportMessageDirection`
  (`INBOUND`/`OUTBOUND`). Purely additive - no changes to `RequestInteraction` or
  `RequestAttentionFlag`.
- Migration: `20260918113336_add_support_context` (created via the `migrate diff --from-url`
  workaround above, due to the pre-existing shadow-database P3006 issue).

---

*Last Updated: February 2026*

### Recent migration: schema/migration drift fix (2026-09)

`20260921180000_fix_schema_migration_drift` adds objects that existed in `schema.prisma` (and in databases built with `db push`) but were never created by any migration: `ReviewStatus` enum, `requests.clientRating`/`clientRatingComment`, `reviews.status`/`moderatedAt`/`moderatedBy`, the `reviews_requestId_fkey`/`reviews_moderatedBy_fkey` constraints, and the removal of `request_interests_serviceProviderId_idx`. Every statement is idempotent (`IF NOT EXISTS` / guarded), so it is a no-op on databases that already have them (Fly/Supabase, existing local DBs) and completes a fresh database built only from migrations. Verified with `prisma migrate diff --from-migrations ... --to-schema-datamodel` against a scratch shadow DB (empty diff afterwards). Rollback: none needed (additive/idempotent); to undo on a scratch DB, drop the added columns manually.

### Recent migration: bidirectional reviews (2026-09-30)

`20260930191429_add_bidirectional_reviews` generalizes `Review` to support both directions
(`ReviewDirection` enum `CLIENT_TO_PROVIDER`/`PROVIDER_TO_CLIENT`), per
`/var/www/specialist/REVIEWS_REDESIGN.md`:

- Schema: new `direction` column (default `CLIENT_TO_PROVIDER` for existing rows), new
  `revieweeUserId` (NOT NULL — the provider's own user for `CLIENT_TO_PROVIDER`, the client for
  `PROVIDER_TO_CLIENT`), `serviceProviderId` becomes nullable (only set for
  `CLIENT_TO_PROVIDER`), new `revealedAt`/`isFeatured`, unique constraint moves from `requestId`
  alone to `(requestId, direction)`, `onDelete: Cascade` added from `Review` to `Request`. New
  `User.clientAverageRating`/`clientTotalReviews` columns.
- **Data migration** (hand-written SQL in the same migration file, since
  `revieweeUserId NOT NULL` can't be added blind against existing rows — see "Never" above):
  1. Backfills `revieweeUserId` for every pre-existing review (all implicitly
     `CLIENT_TO_PROVIDER`) by resolving the reviewed `ServiceProvider`'s `Professional`/`Company`
     owner.
  2. Backfills `Request.clientRating`/`clientRatingComment` into
     `Review(direction: PROVIDER_TO_CLIENT, status: APPROVED, revealedAt: Request.updatedAt)` for
     every request that has a legacy rating (per the product decision: backfill legacy as already
     `APPROVED`/revealed, so the client aggregate doesn't start at zero). Idempotent (`NOT
     EXISTS` guard) in case of a retried partial deploy.
  3. Recomputes `User.clientAverageRating`/`clientTotalReviews` from the reviews backfilled in
     step 2.
  `Request.clientRating`/`clientRatingComment` columns are **kept** for read compat; no code path
  writes them after this migration (`RequestService.rateClient` now creates a `Review` via
  `ReviewService.createProviderToClientReview` instead).
- Verified locally: ran via `prisma migrate deploy` against the dev DB (`especialistas`, the db
  the `app` compose service actually uses — see the `DATABASE_URL`/`POSTGRES_DB` note in
  `docker-compose.dev.yml`, not the stale `specialistas` name in some local `.env` files), backfill
  produced the expected `PROVIDER_TO_CLIENT`/`APPROVED` row(s) and recomputed
  `clientAverageRating`/`clientTotalReviews`, checked with `psql`.
- Rollback: not additive — a manual rollback would need to drop `direction`/`revieweeUserId`/
  `revealedAt`/`isFeatured` from `reviews`, drop `clientAverageRating`/`clientTotalReviews` from
  `users`, delete the backfilled `PROVIDER_TO_CLIENT` rows (`WHERE direction =
  'PROVIDER_TO_CLIENT' AND "moderatedBy" IS NULL AND status = 'APPROVED'` is a reasonable filter
  for the backfilled-not-real-moderation ones, though not watertight if a real admin also
  approved a `PROVIDER_TO_CLIENT` review without moderating — i.e. never, since approval always
  sets `moderatedBy`), and restore the old `requestId`-only unique constraint. Not implemented as
  a down-migration; redo from a pre-migration backup if ever needed in production.
