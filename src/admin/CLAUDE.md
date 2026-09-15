# Admin context (`src/admin`)

Thin facade for the admin portal (`/var/www/specialist/specialist-admin`, Next.js). It has no
repositories of its own: `AdminService` composes `UserService`, `ProfessionalService`,
`CompanyService`, `RequestService` (and their query repositories through those services).
Docs: `docs/plans/admin-portal-plan.md` (roadmap, partly stale).

## Endpoints (`/admin`, `JwtAuthGuard` + `AdminGuard`)

`GET users`, `GET users/:id`, `PUT users/:id/status`, `PUT users/:id/verification` (manual
email/phone verified override), `GET professionals`, `GET professionals/:id`,
`PUT professionals/:id/status`, `GET requests?status=`, `GET companies`, `GET companies/:id`,
`PUT companies/:id/status`, `GET dashboard/stats`. Review moderation lives in
`/reviews/admin/pending|:id/approve|:id/reject` (Reputation); notification admin in
`/admin/notifications` (Notifications); company verification in `/companies/:id/verify` (Profiles).

## Rules

- Keep this context free of business rules and Prisma: add read models to the owning context's
  `*QueryRepository` and expose them via that context's service (`getXForAdmin`, `getXStats`).
- Pagination `page`/`limit` -> `{ data, meta }`.
- Status changes go through the owning entity's `canChangeStatusBy` + `withStatus`/`updateStatus`
  in the owning service, with the admin `UserEntity` passed as acting user.
- DTOs: `update-user-status.dto.ts`, `update-user-verification.dto.ts`,
  `update-professional-status.dto.ts`, `update-company-status.dto.ts`.

## Backlog

Audit log for admin actions, `/admin/reviews/*` aliases, richer dashboard stats.

## Tests

`admin.service.spec.ts`.
