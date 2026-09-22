# Seed-data scripts

Pure HTTP client scripts that generate manual-QA data against a **running** backend (local or
deployed) — unlike `test/scripts/whatsapp/**`, these never touch Prisma/`DATABASE_URL` directly,
so they work the same way against `localhost:5000` or the Fly.io testing deploy.

## `generate-diverse-requests.ts`

Creates 11 `Request`s spread across most of the 15-state machine (see
`../../../docs/architecture/EspecialistBRC — Estados del pedido.md`) using the seeded test users:
public (bolsa) and direct requests, one with multiple interested providers, contact released via
both paths, in progress, finished awaiting confirmation, closed (rated and unrated), and under
review. Drives the WhatsApp-only transitions (agreement / progress / satisfaction) through the
dev-only admin endpoints (`POST /admin/whatsapp/conversations/:id/trigger-followup` +
`.../simulate-reply`, see `../../../docs/guides/whatsapp/README.md`) instead of real WhatsApp.

Does **not** cover `EXPIRED`/`NO_RESPONSE`/`ABANDONED`/auto-`CLOSED` (only `RequestExpirationJob`,
disabled by default, produces those — this script never backdates a request to fake elapsed time)
or `REJECTED`/`CANCELLED` (left out of this batch's scope, see `../../../../TODO.md`).

Requires: the target environment already seeded (`npm run db:seed`), and dev-mode WhatsApp tools
available there (`WHATSAPP_PROVIDER=local` + `NODE_ENV!=production` or
`WHATSAPP_DEV_MODE_ENABLED=true` — true locally by default, and on the Fly.io deploy per
`fly.toml`).

```bash
npm run seed:diverse-requests                                              # localhost:5000
npm run seed:diverse-requests -- --api-url=https://specialist-api.fly.dev/api
API_URL=https://specialist-api.fly.dev/api npm run seed:diverse-requests   # equivalent
```

Safe to re-run: it always creates new requests (no dedup), so running it twice just doubles the
data — re-seed the DB first if you want a clean slate.
