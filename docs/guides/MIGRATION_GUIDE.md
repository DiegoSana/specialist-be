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
against a throwaway shadow database before diffing your schema change. This repo has one migration
folder whose timestamp doesn't sort where it was actually applied historically -
`20250127000000_add_request_interactions` (year `2025`) sorts *before*
`20251215200251_init`, which is the migration that creates the `requests` table
`request_interactions` has a foreign key to. Replaying from empty therefore fails with:

```
Error: P3006
Migration `20250127000000_add_request_interactions` failed to apply cleanly to the shadow database.
Error code: P1014
Error: The underlying table for model `requests` does not exist.
```

This is pre-existing and unrelated to whatever change you're making - do **not** rename or reorder
that migration folder (`scripts/baseline-migrations.sh` lists it first for a reason, and it's
already applied in every real environment under that exact name; renaming it risks P3015
elsewhere, see above). Work around the broken shadow database instead: diff directly against the
live database (no shadow DB involved) and apply/record the result yourself:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma db execute --file prisma/migrations/<timestamp>_<name>/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied <timestamp>_<name>
npx prisma migrate status   # should report "Database schema is up to date!"
npx prisma generate
```

(This was used to create `20260918113336_add_support_context`.) Then continue as usual - review the
generated SQL, run `npm test`, etc.

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
