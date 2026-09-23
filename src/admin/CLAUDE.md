# Admin context (`src/admin`)

Thin facade for the admin portal (`/var/www/specialist/specialist-admin`, Next.js). It has no
repositories of its own: `AdminService` composes `UserService`, `ProfessionalService`,
`CompanyService`, `RequestService`, `RequestInterestService`, `ReviewService` (Reputation, via
`ReputationModule`) (and their query repositories through those services). Docs:
`docs/plans/admin-portal-plan.md` (roadmap, partly stale).

## Endpoints (`/admin`, `JwtAuthGuard` + `AdminGuard`)

`GET users?search=&type=` (isAdmin/hasClientProfile/hasProfessionalProfile/hasCompanyProfile on
every item; `search` matches email/firstName/lastName, case-insensitive; `type` is
`CLIENT|PROFESSIONAL|COMPANY`, filters to users who have that profile — there's no `ADMIN` type
since `isAdmin` is a plain boolean on `User`, not a profile relation like the other three), `GET
users/:id` (adds `professionalId`/`companyId`, `string | null` — the Professional/Company profile's
own `id`, resolved via `professionalService.findByUserId`/`companyService.findByUserId`, catching
their not-found throw as `null`, same pattern as `ProfileActivationService.getActivationStatus`;
for linking to `/admin/professionals/:id` / `/admin/companies/:id`), `PUT
users/:id/status`, `PUT users/:id/verification` (manual email/phone verified override), `PUT
users/:id/whatsapp-opt-out` (manual `User.whatsappOptedOut` override, body `{ whatsappOptedOut:
boolean }` via `UpdateUserWhatsAppOptOutDto`; no-op if unchanged; setting `false -> true`
publishes `UserWhatsAppOptedOutEvent` (same as the automatic WhatsApp reply path), setting
`true -> false` publishes `UserWhatsAppReactivatedEvent` (admin-only path, no automatic producer)
— see Identity context's CLAUDE.md), `GET
professionals`, `GET professionals/:id`, `PUT professionals/:id/status`, `GET requests?status=`
(each item's `provider` is `{ id, type, name } | null`), `GET requests/:id` (full detail: client,
trade, unified `provider` with `trades`, `interestedProviders` via
`RequestInterestService.getInterestedProviders` with an admin-bypass ctx - no `canBeViewedBy`
check; also `isPublic: boolean` and `review: { id, rating, comment, status } | null` - the
request's single review, resolved via `ReviewService.findByRequestId`, `null` when none exists
yet), `PUT requests/:id/status` (body `{ status: RequestStatus, statusReason? }`, delegates to
`RequestService.updateStatus` with the same lightweight admin ctx `{ userId, isAdmin: true }`;
`RequestEntity.canChangeStatusBy` grants admin an unconditional bypass, so this can move a request
to any of the 15 statuses; returns `RequestResponseDto.fromEntity` from the `requests` context -
the one case in this file that imports a sibling context's `presentation/` DTO, mirroring the
`InterestedProfessionalResponseDto` reuse already done in `AdminRequestDetailResponseDto`), `GET
companies`, `GET companies/:id`, `PUT companies/:id/status`, `GET dashboard/stats`.
Review moderation lives in `/reviews/admin/pending|:id/approve|:id/reject` (Reputation);
notification admin in `/admin/notifications` (Notifications); company verification in
`/companies/:id/verify` (Profiles).

## Rules

- Keep this context free of business rules and Prisma: add read models to the owning context's
  `*QueryRepository` and expose them via that context's service (`getXForAdmin`, `getXStats`).
- Pagination `page`/`limit` -> `{ data, meta }`.
- Status changes go through the owning entity's `canChangeStatusBy` + `withStatus`/`updateStatus`
  in the owning service, with the admin `UserEntity` passed as acting user.
- DTOs: `update-user-status.dto.ts`, `update-user-verification.dto.ts`,
  `update-user-whatsapp-opt-out.dto.ts`, `update-professional-status.dto.ts`,
  `update-company-status.dto.ts`, `update-request-status.dto.ts`.

## Backlog

Audit log for admin actions, `/admin/reviews/*` aliases, richer dashboard stats.

## Tests

`admin.service.spec.ts`.
