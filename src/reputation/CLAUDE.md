# Reputation context (`src/reputation`)

Owns `Review` (client -> provider after a CLOSED request) with admin moderation and the provider
rating recomputation. Docs: `docs/guides/REVIEW_MODERATION.md` (Prisma snippet is stale; schema
uses `serviceProviderId` and required unique `requestId`).

## Public API (exported by `ReputationModule`)

`ReviewService`: `buildAuthContext`, `findByServiceProviderId`, `findByProfessionalId` (legacy),
`findById`, `findByIdForUser`, `findByRequestId`, `findByRequestIdForUser`, `create`, `approve`,
`reject`, `findPending`, `update`, `delete`.

## Endpoints

`/reviews` POST (creates `PENDING`), GET `?requestId=`, `/:id` GET/PATCH/DELETE (author while
PENDING), `/reviews/admin/pending` GET, `/:id/approve` POST, `/:id/reject` POST (AdminGuard).
`/professionals/:professionalId/reviews` GET (public, approved only).

## Domain

- `ReviewEntity`: `create(...)`, `withChanges`, `approve(moderatorId)`, `reject(moderatorId)`,
  `isPending/isApproved/isRejected`, `isValidRating` (1..5), `ReviewAuthContext { userId, isAdmin, isReviewer }`,
  `canBeViewedBy` (approved = public; pending/rejected = author or admin), `canBeModifiedBy`
  (author while pending), `canBeModeratedBy` (admin while pending).
- `ReviewStatus`: `PENDING|APPROVED|REJECTED`. Value objects `Rating`, `ReviewStatus`.
- Event `reputation.review.approved` -> Notifications handler notifies the provider user.

## Invariants

- One review per request (`Review.requestId` unique, required); request must be `CLOSED` and the
  reviewer must be its client; target is `serviceProviderId`.
- Only APPROVED reviews count toward `ServiceProvider.averageRating/totalReviews` and public lists.
  Approve/reject recompute the rating through `ProfessionalService.updateRating` /
  `CompanyService.updateRating` (services, not repositories).
- Cross-context reads (request, user, provider) go through `RequestService`, `UserService`,
  `ProfessionalService`, `CompanyService`.

## Tests

`review.service.spec.ts`. Admin moderation UI is pending in `specialist-admin` (backlog).
