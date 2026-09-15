---
paths:
  - "prisma/**"
  - "scripts/**"
  - "docker-compose*.yml"
  - "fly.toml"
  - "Dockerfile*"
---

# Database, migrations, seed and deployment

Source of truth: `docs/guides/MIGRATION_GUIDE.md`, `docs/guides/DOCKER.md`, `docs/guides/ENVIRONMENT_VARIABLES.md`.

## Migration workflow (dev)

1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <snake_case_description>` (creates `prisma/migrations/<timestamp>_<name>/migration.sql` and applies it).
3. `npx prisma generate`.
4. Review the generated SQL. For destructive changes (drop column, type change) write the data
   migration explicitly in the SQL and document it in MIGRATION_GUIDE.md with a rollback note.
5. Update `prisma/seed.ts` if the model changed; run `npm run db:seed` locally to verify.
6. Update mappers/entities/DTOs (see `add-entity-field` skill) and `npm test`.

Inside Docker dev: `docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev --name <name>`.

## Never

- `prisma migrate reset` or `db push --force-reset` (`npm run db:reset`) against anything but a
  local dev DB. They drop all data.
- `prisma db seed` against production: the seed deletes and recreates rows.
- Editing an already-applied migration file. Add a new migration instead.
- Committing `.env`. Secrets go to `fly secrets set`; non-sensitive config to `fly.toml [env]`.
- Renaming a migration folder after it was applied anywhere (causes P3015 "Migration not found";
  fix with `scripts/fix-migration-record.sql` or `prisma migrate resolve`).

## Production

- `npx prisma migrate deploy` runs on container start (prod compose) or manually on Fly:
  `fly ssh console` then `cd /app && npx prisma migrate deploy`.
- Supabase: migrations and seed need the direct/session connection on port 5432, not the
  transaction pooler on 6543. With pgBouncer, set `directUrl = env("DIRECT_URL")`.
- Deploy is automatic on push to `main` (`.github/workflows/deploy.yml`: `npm test` -> `flyctl deploy` -> health check `https://specialist-api.fly.dev/api/health`).

## Seed data (`prisma/seed.ts`)

Creates admin `admin@specialist.com`, clients `cliente1..4@test.com`, providers
`electricista|plomero|gasista|carpintero|pintor|multioficio@test.com`, trades and sample
requests. Passwords are set in the seed file; do not paste them into docs or messages.

## Ports and local services

Dev API `http://localhost:5000/api` (Swagger `/api/docs`), Postgres via `POSTGRES_PORT`, Mailpit
UI `:8025` / SMTP `:1025` (`docker-compose.dev.yml`). Fly runs on `PORT=8080`. `CORS_ORIGINS` is a
comma-separated list and must include any new frontend origin.
