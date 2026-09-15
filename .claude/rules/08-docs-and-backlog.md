---
paths:
  - "docs/**"
  - "TODO.md"
  - "README.md"
---

# Documentation and backlog conventions

`docs/README.md` is the index; every new doc must be linked there. Structure:
`docs/API.md`, `docs/API_STRUCTURE.md` (endpoints), `docs/architecture/` (design), `docs/decisions/`
(ADRs), `docs/guides/` (how-tos), `docs/plans/` (roadmaps, may go stale), `docs/notes/` (reviews).

## What to update when

| Change | Update |
|---|---|
| Endpoint added/changed | `docs/API.md`, `docs/API_STRUCTURE.md`, `PERMISSIONS_BY_ROLE.md` if roles change |
| Permission rule | `docs/guides/PERMISSIONS_BY_ROLE.md`, "Módulos Implementados" table in `AUTHORIZATION_PATTERN.md` |
| Schema/migration | `docs/guides/MIGRATION_GUIDE.md` (destructive ones get a section), `DOMAIN_MODEL.md` if you touch it |
| New env var | `docs/guides/ENVIRONMENT_VARIABLES.md` (say whether secret or `fly.toml`) |
| Architectural decision | new ADR `docs/decisions/ADR-005-<TOPIC>.md` (next free number; two files share 002) using the `write-adr` skill, plus a line in `docs/README.md` |
| Notification type / template | `docs/guides/NOTIFICATIONS.md` or `docs/guides/whatsapp/README.md` |
| Session/backlog progress | `TODO.md` ("Donde quedamos hoy" recap + checkboxes) |

## Language

Existing docs mix Spanish and English; the stated direction (ARCHITECTURE.md) is to migrate to
English. Write new docs and ADRs in English. Do not translate existing Spanish docs unless asked.
User-facing copy examples stay in Spanish (es-AR).

## Doc freshness

All architecture docs were refreshed against the code on 2026-09-15 (DOMAIN_MODEL, ROLES_ARCHITECTURE,
COMPANY_PROFILES, REVIEW_MODERATION, ADR-004 naming, ports/defaults in DOCKER/ENV/NOTIFICATIONS).
`docs/plans/*` are roadmaps and may lag; `docs/plans/whatsapp-followup-implementation-status.md` is
explicitly historical. When code and a doc disagree, `prisma/schema.prisma`, entities, `main.ts`
and `fly.toml` win; fix the doc in the same change and mention it in the commit body.

## Known code/doc discrepancies (documented, not yet fixed in code)

- `ReviewService.updateServiceProviderRating` only recomputes ratings for Professional providers
  (TODO for Company; `CompanyService.updateRating` exists but is unused).
- `CreateReviewDto.professionalId` is required by validation but ignored by the service; `requestId`
  is optional in the DTO but required by the service.
- `ADR-004` historically called the counter `reviewCount`; schema/entities use `totalReviews`.
- `@specialist/shared` (separate repo) exposes a role-based `User` type that no longer matches the
  backend (profile flags); only `specialist-admin` login uses it.
