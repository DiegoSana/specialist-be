# Reputation context (`src/reputation`)

Owns `Review` — bidirectional since the 2026-09-30 redesign (`direction:
CLIENT_TO_PROVIDER|PROVIDER_TO_CLIENT`, at most one per `(requestId, direction)`), admin
moderation, provider/client rating recomputation, and the doble-ciego-con-timeout reveal.
Full spec: `/var/www/specialist/REVIEWS_REDESIGN.md`. Docs: `docs/guides/REVIEW_MODERATION.md`
(stale — predates the bidirectional shape).

## Public API (exported by `ReputationModule`)

`ReviewService`: `buildAuthContext`, `findByServiceProviderId`, `findByProfessionalId` (legacy),
`findById`, `findByIdForUser`, `findByRequestIdForUser(requestId, userId, direction?)` (direction
defaults to `CLIENT_TO_PROVIDER` for back-compat), `getRequestReviewsForViewer(requestId,
viewerUserId)` (splits a request's 0-2 reviews into `myReview`/`counterpartReview` from the
viewer's perspective — used cross-context by `RequestResponseDto`/`AdminService`),
`findFeaturedClientReviews(clientUserId, limit?)`, `create` (CLIENT_TO_PROVIDER, called from
`POST /reviews`), `createProviderToClientReview(reviewerId, {requestId, rating, comment})`
(PROVIDER_TO_CLIENT, called cross-context from `RequestService.rateClient`), `approve`, `reject`,
`setFeatured`, `findPending`, `update`, `delete`, `deleteAllForRequest` (both directions, used by
`RequestPublishedAgainHandler`), `updateServiceProviderRating`, `updateClientRating`,
`hasReviewForRequestAndDirection` (used by the requests follow-up scheduler to stop nudging a
party who already rated).

## Endpoints

`/reviews` POST (creates CLIENT_TO_PROVIDER, `PENDING`), GET `?requestId=&direction=` (direction
optional), `/:id` GET/PATCH/DELETE (author while PENDING), `/reviews/admin/pending` GET,
`/:id/approve` POST, `/:id/reject` POST, `/:id/feature` POST (body `{isFeatured}`, admin, only on
APPROVED reviews) (all four AdminGuard). `/professionals/:professionalId/reviews` GET (public,
approved only). `POST /requests/:id/rate-client` (requests context) creates the PROVIDER_TO_CLIENT
review — see `src/requests/CLAUDE.md`.

## Domain

- `ReviewEntity`: `create(...)` (now takes `direction`, `revieweeUserId`, nullable
  `serviceProviderId`), `withChanges`, `approve(moderatorId)`, `reject(moderatorId)`,
  `reveal(now?)`, `withFeatured(isFeatured, now?)`, `isPending/isApproved/isRejected/isRevealed`,
  `isClientToProvider/isProviderToClient`, `isValidRating` (1..5).
  `ReviewAuthContext { userId, isAdmin, isReviewer, isReviewee? }`, `canBeViewedBy` (approved =
  public; pending/rejected = author or admin — this is about the row existing, not its content),
  `canRevealContentBy`/`isVisibleTo(viewerUserId, isAdmin)` (doble-ciego gate: admin or the
  review's own author always see it; anyone else only once `isApproved() && isRevealed()`),
  `canBeModifiedBy` (author while pending), `canBeModeratedBy` (admin while pending),
  `canBeFeaturedBy` (admin, only on approved reviews).
- `ReviewStatus`: `PENDING|APPROVED|REJECTED` (unchanged). `ReviewDirection` (Prisma enum):
  `CLIENT_TO_PROVIDER|PROVIDER_TO_CLIENT`. Value objects `Rating`, `ReviewStatus`.
- Event `reputation.review.approved` — CLIENT_TO_PROVIDER only (no `ServiceProvider` to resolve a
  notification target for on the other direction); Notifications handler notifies the provider
  user. No event is published when a PROVIDER_TO_CLIENT review is approved (TODO if the client
  ever needs an in-app/WhatsApp notification for that).
- `RevealReviewsJob` (`application/jobs/reveal-reviews.job.ts`): same `@Cron` + feature-flag
  pattern as `RequestExpirationJob` (requests context), but lives here because it only needs
  `REVIEW_REPOSITORY`. Flag `REVIEW_REVEAL_ENABLED` (off by default), `REVIEW_REVEAL_TIMEOUT_DAYS`
  (default 14). Runs hourly at :15. Reveals a request's APPROVED review(s) once both directions
  are APPROVED (this branch is normally already handled synchronously and immediately by
  `ReviewService.approve` — see below — so this job mostly only ever needs to act on the timeout
  branch in practice) or once `REVIEW_REVEAL_TIMEOUT_DAYS` have elapsed since the *earliest*
  review on the request was created, whichever comes first. `ReviewService.approve` also runs the
  immediate "both APPROVED" reveal synchronously right after approving, so the common case doesn't
  wait for the next cron tick.

## Handlers (subscribe in `onModuleInit`)

- `RequestPublishedAgainHandler` (`application/handlers/request-published-again.handler.ts`):
  subscribes to `RequestStatusChangedEvent.EVENT_NAME` (`requests` context, imported only for its
  `domain/events` per the cross-context rules). When `event.payload.toStatus === PUBLISHED`, calls
  `ReviewService.deleteAllForRequest(requestId)`, which deletes **both** directions' reviews for
  that request (if present) and recomputes whichever rating(s) were affected
  (`updateServiceProviderRating` and/or `updateClientRating`) — bypassing reviewer-only
  authorization, since this is a system cleanup that must remove reviews regardless of status.
  Exists because `Review(requestId, direction)` is unique — a request can have at most one review
  per direction, ever — and both `RequestInterestService.unassignProvider` and
  `RequestService.updateStatus`'s PUBLISHED normalization publish this event whenever they clear a
  stale `providerId`, meaning the request is restarting its engagement (unassign-then-reassign is
  a supported flow) - without this handler, leftover reviews from the previous provider would
  permanently block reviewing whoever gets assigned next, or survive incorrectly into the new
  engagement. Lives here (not in `requests`) to avoid the wrong direction of circular module
  dependency at this layer; mirrors `RequestAttentionFlaggedHandler`'s cross-context pattern in
  `notifications`. The companion `clientRating`/`clientRatingComment` reset (the deprecated flat
  fields, kept for read compat only) still lives in the two `requests` call sites themselves - see
  `src/requests/CLAUDE.md`.

## Cross-context circular dependency (RequestsModule <-> ReputationModule)

`RequestService.rateClient` needs `ReviewService.createProviderToClientReview`, and
`ReviewService.create`/`createProviderToClientReview` need `RequestService.findById` — both module
imports use `forwardRef(() => X)` (`ReputationModule` -> `RequestsModule` and `RequestsModule` ->
`ReputationModule`), and both service constructor injections of the other context's service use
`@Inject(forwardRef(() => XService))`. `FollowUpSchedulerJob` (requests context) also injects
`ReviewService` (forwardRef) for the CLOSED-notice review gate (see `src/requests/CLAUDE.md`'s
follow-up section).

## Invariants

- At most one review per `(requestId, direction)` (unique constraint); request must be `CLOSED`.
  `CLIENT_TO_PROVIDER`: reviewer must be the request's client, target is `serviceProviderId`
  (resolved to `revieweeUserId` = the provider's own user). `PROVIDER_TO_CLIENT`: reviewer is the
  assigned provider's user (authorization enforced by `RequestService.rateClient` via
  `RequestEntity.canRateClientBy`, not re-checked here), target is `revieweeUserId` = the client;
  `serviceProviderId` is `null`.
- Direction is **never** accepted from the request body — always inferred server-side from which
  endpoint/caller created the review, to prevent spoofing (REVIEWS_REDESIGN.md 4.2).
- Only APPROVED reviews count toward `ServiceProvider.averageRating/totalReviews` (CLIENT_TO_PROVIDER)
  or `User.clientAverageRating/clientTotalReviews` (PROVIDER_TO_CLIENT), and toward public/featured
  lists. Approve/reject/delete/deleteAllForRequest recompute the appropriate one via
  `ProfessionalService.updateRating` / `CompanyService.updateRating` / `UserService.updateClientRating`
  (services, not repositories). `updateServiceProviderRating` still only handles Professional
  providers (pre-existing TODO for Company, unrelated to this redesign — see
  `docs/guides/PERMISSIONS_BY_ROLE.md`/08-docs-and-backlog.md's known-discrepancies list).
- `isFeatured` is admin-curated only (`POST /reviews/:id/feature`), never algorithmic, and only
  settable on an APPROVED review.
- `revealedAt` gates *content* visibility to the counterpart (not row existence/moderation
  visibility, which `canBeViewedBy` already handled pre-redesign) — see `ReviewEntity.isVisibleTo`.
- Cross-context reads (request, user, provider) go through `RequestService`, `UserService`,
  `ProfessionalService`, `CompanyService`.

## Tests

`review.service.spec.ts`, `request-published-again.handler.spec.ts`. Admin moderation UI
(`specialist-admin`) needs a `direction` column + "Destacar" toggle added for the bidirectional
shape (tracked in the cross-repo redesign plan, not this repo).
