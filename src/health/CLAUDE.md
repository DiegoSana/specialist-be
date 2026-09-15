# Health (`src/health`)

`GET /api/health` used by Fly.io deploy health check (`.github/workflows/deploy.yml`) and Docker.
Allowed to inject `PrismaService` directly (fitness-function exception) for a DB ping. Keep it
dependency-free otherwise; never add business endpoints here.
