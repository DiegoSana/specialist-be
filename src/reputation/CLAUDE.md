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

## Handlers (subscribe in `onModuleInit`)

- `RequestPublishedAgainHandler` (`application/handlers/request-published-again.handler.ts`):
  subscribes to `RequestStatusChangedEvent.EVENT_NAME` (`requests` context, imported only for its
  `domain/events` per the cross-context rules). When `event.payload.toStatus === PUBLISHED`, it
  looks up an existing `Review` for that `requestId` (`REVIEW_REPOSITORY.findByRequestId`, same DI
  token `ReviewService` already uses) and deletes it if found (`REVIEW_REPOSITORY.delete(id)`).
  Injects `REVIEW_REPOSITORY` directly rather than going through `ReviewService.delete`, because
  that method enforces `canBeModifiedBy` (author while pending) - the wrong shape of authorization
  for a system-triggered cleanup that must also remove an already-APPROVED review. After deleting,
  it calls the now-public `ReviewService.updateServiceProviderRating(serviceProviderId)` - the same
  recalculation `approve`/`delete` already trigger - so removing an APPROVED review doesn't leave
  the provider's cached `averageRating`/`totalReviews` stale. Wrapped in try/catch + `Logger`,
  mirrors `RequestAttentionFlaggedHandler`'s pattern in `notifications`.
  Exists because `Review.requestId` is unique (at most one review per request, ever): both
  `RequestInterestService.unassignProvider` and `RequestService.updateStatus`'s PUBLISHED
  normalization publish this event with `toStatus: PUBLISHED` whenever they clear a stale
  `providerId`, meaning the request is restarting its engagement (unassign-then-reassign is a
  supported flow) - without this handler, a leftover review from the previous provider would
  permanently block the client from ever reviewing whoever gets assigned next. Lives here (not in
  `requests`) to avoid a circular module dependency: `ReputationModule` already imports
  `RequestsModule`, not the other way around. The companion `clientRating`/`clientRatingComment`
  reset lives in the two `requests` call sites themselves (see `src/requests/CLAUDE.md`), not here
  - no cross-context call needed for that part since both fields live on `Request`.

## Invariants

- One review per request (`Review.requestId` unique, required); request must be `CLOSED` and the
  reviewer must be its client; target is `serviceProviderId`.
- Only APPROVED reviews count toward `ServiceProvider.averageRating/totalReviews` and public lists.
  Approve/reject recompute the rating through `ProfessionalService.updateRating` /
  `CompanyService.updateRating` (services, not repositories).
- Cross-context reads (request, user, provider) go through `RequestService`, `UserService`,
  `ProfessionalService`, `CompanyService`.

## Tests

`review.service.spec.ts`, `request-published-again.handler.spec.ts`. Admin moderation UI is
pending in `specialist-admin` (backlog).
