---
name: prisma-migration
description: Create, review, apply or repair Prisma migrations for specialist-be safely (dev vs prod, Supabase pooler caveats, P3015 orphan migration fix, baselining, seed). Use for "create a migration", "migration failed", "P3015", "deploy migrations to Fly/Supabase".
---

# prisma-migration

Source: `docs/guides/MIGRATION_GUIDE.md`, `.claude/rules/07-database-migrations.md`.

## Create (dev)

```bash
npx prisma validate
npx prisma migrate dev --name <snake_case>     # never `db push` for tracked changes
npx prisma generate
cat prisma/migrations/<timestamp>_<name>/migration.sql   # review: destructive statements? defaults for NOT NULL on populated tables?
npm test
```

Naming examples from history: `add_request_title`, `add_service_provider`,
`remove_profile_contact_and_active`, `add_phone_email_verification`.

## Destructive or data-moving changes

Write the data step in the same `migration.sql` (e.g. `UPDATE users u SET phone = p.whatsapp FROM professionals p WHERE ...` before `ALTER TABLE ... DROP COLUMN`), document it with a rollback
section in `MIGRATION_GUIDE.md`, and tell the user which columns disappear.

## Apply to production (Fly.io + Supabase)

```bash
fly ssh console -a specialist-api
cd /app && npx prisma migrate status && npx prisma migrate deploy
```
Use the direct/session connection (port 5432, `postgres.<ref>@aws-0-<region>.pooler.supabase.com`
from IPv4), never the transaction pooler (6543). Confirm with the user before running anything
against production; never `migrate reset`, `db push --force-reset` or `db seed` there.

## Repair

- **P3015 migration not found**: an applied migration folder is missing or renamed. Either restore
  the folder, or remove the orphan row with `scripts/fix-migration-record.sql`
  (`npx prisma db execute --file scripts/fix-migration-record.sql`), see also
  `scripts/remove-orphan-migration-dir.sh`, `scripts/list-migrations.sql`.
- **Baseline an existing DB**: `scripts/baseline-migrations.sh` or
  `npx prisma migrate resolve --applied <migration_name>` per migration.
- **Drift in dev**: `npm run db:reset` (drops local data, reseeds) is acceptable only for the local
  dev DB.

## Seed

`npm run db:seed` (`npx tsx prisma/seed.ts`). Update the seed whenever a model changes so
`db:reset` keeps working; it is the fixture set used for manual testing and e2e.
