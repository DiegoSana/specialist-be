# Requests context (`src/requests`)

Owns service requests (public job board or direct to a provider), provider interests, provider
assignment, client rating, and the WhatsApp follow-up subsystem (`RequestInteraction`).
Docs: `docs/guides/PERMISSIONS_BY_ROLE.md`, `docs/guides/whatsapp/README.md`,
`docs/notes/REQUEST_CONTROLLER_TODOS_REVIEW.md`.

## Public API (exported by `RequestsModule`)

- `RequestService`: `create(clientId, dto)`, `findById`, `findByIdForUser`,
  `findByIdForInterestedProvider` (limited view), `buildAuthContext`, `findByClientId`,
  `findByProviderId`, `findPublicRequests`, `findAvailableForProfessional(tradeIds, city, zone)`
  (legacy name, serves any provider), `updateStatus`, `addRequestPhoto`, `removeRequestPhoto`,
  `rateClient`, `getRequestStats`, `getAllRequestsForAdmin`.
- `RequestInterestService`: `buildAuthContext`, `expressInterest`, `removeInterest`,
  `getInterestedProviders`, `hasExpressedInterest`, `getMyInterestedRequests`, `assignProvider`,
  `unassignProvider`.
- `RequestInteractionService`: `sendMessage`, `markAsDelivered`, `processInboundMessage`,
  `createFollowUp`.
- `AdminWhatsAppService`: `isDevMode`, `getConfig`, `listConversations`, `getThread`,
  `simulateReply` (dev mode only), `triggerFollowUp` (dev mode only). Backs the admin WhatsApp
  conversations viewer; see `docs/guides/whatsapp/README.md`.

## Endpoints (`/requests`, all JWT)

`POST /` create, `GET /` mine (client + provider views), `GET /available` job board,
`GET /interested` my interests, `GET /:id`, `PATCH /:id`, `POST|DELETE /:id/photos`,
`POST|DELETE|GET /:id/interest`, `GET /:id/interests` (owner), `POST /:id/assign-provider`,
`POST /:id/unassign-provider`, `POST /:id/rate-client`. Webhook: `POST /webhooks/twilio`
(`TwilioWebhookGuard` + `TwilioRateLimitGuard`, no JWT).

Admin (`/admin/whatsapp`, `JwtAuthGuard` + `AdminGuard`): `GET config`, `GET conversations`,
`GET conversations/:requestId` always registered (`AdminWhatsAppController`); `POST
conversations/:requestId/simulate-reply` and `POST conversations/:requestId/trigger-followup`
live in a separate `AdminWhatsAppDevController`, registered only when `NODE_ENV !== 'production'`,
and additionally 404 (not 403) at runtime unless `isWhatsAppDevMode()` is true.

## Domain

- `RequestEntity`: `createPending(...)`, `withChanges`, predicates per `RequestStatus`
  (`PENDING|ACCEPTED|IN_PROGRESS|DONE|CANCELLED`), `canBeReviewed()` (= DONE).
  `providerId` is a `ServiceProvider` id; `professionalId` getter is deprecated.
  `RequestAuthContext { userId, serviceProviderId?, isAdmin?, hasActiveClientProfile?, hasActiveProviderProfile? }`.
  Rules: `canBeViewedBy`, `canManagePhotosBy`, `canChangeStatusBy(ctx, newStatus)`,
  `canRateClientBy`, `canExpressInterestBy` (needs active provider), `canAssignProviderBy`
  (needs active client), `canUnassignProviderBy`.
- Status transitions: client -> `ACCEPTED|CANCELLED`; assigned provider -> `IN_PROGRESS|DONE`;
  admin any. Direct request needs `professionalId|companyId` (resolved to `providerId`) and an
  active provider; public request needs `tradeId` and starts unassigned.
- `RequestInterest`: association store (`add/remove/removeAllByRequestId`), unique per
  `(requestId, serviceProviderId)`.
- `RequestInteractionEntity`: WhatsApp message lifecycle `PENDING->SENT->DELIVERED->RESPONDED|FAILED`,
  `markAsSent/markAsDelivered/markAsResponded/markAsFailed`, idempotent on `twilioMessageSid`.
- Events: `requests.request.created`, `requests.request.status_changed`,
  `requests.request_interest.expressed`, `requests.request.professional_assigned`,
  `requests.interaction.responded`. Payloads carry `serviceProviderId`, `providerUserId`,
  `providerType`, `providerName`.
- Follow-up rules (`domain/follow-up` contracts, `application/follow-up/rules` strategies):
  ACCEPTED 3d/7d -> provider, IN_PROGRESS 5d/10d -> provider, DONE 1d -> client (review),
  PENDING 3d with interests -> client (assign). Registered via `FOLLOW_UP_RULES` factory in the module.

## Infrastructure

`PrismaRequestRepository` (`fullInclude` with client, provider -> professional|company -> user,
trade), `PrismaRequestQueryRepository` (stats/admin), `PrismaRequestInteractionQueryRepository`
(admin conversations list, one row per request with >=1 interaction; `search` is pushed into
Prisma's `groupBy` only when absent, otherwise fetched unfiltered and filtered in memory - see the
comment in the file), `PrismaRequestInterestRepository`, `PrismaRequestInteractionRepository`.
`WHATSAPP_MESSAGING_PORT` is provided by `whatsapp-messaging.factory.ts` (mirrors
`email-sender.factory.ts`): `TwilioWhatsAppAdapter` by default, or `LocalWhatsAppAdapter` (no
network call, `local-<uuid>` message ids) when `WHATSAPP_PROVIDER=local`. `WHATSAPP_PROVIDER`
defaults to `twilio` so production can never silently go fake; `isWhatsAppDevMode()`
(`application/services/whatsapp-dev-mode.ts`) additionally requires `NODE_ENV !== 'production'`
and gates the dev-only admin endpoints (see `docs/guides/whatsapp/README.md`).
Jobs: `FollowUpSchedulerJob` (hourly; also exposes `forceTriggerRule(ruleName, requestId)` for the
admin "trigger now" endpoint), `WhatsAppDispatchJob` (1 min), `MessageStatusCheckerJob`
(5 min); flags `WHATSAPP_FOLLOWUP_ENABLED`, `WHATSAPP_STATUS_CHECK_ENABLED`.

## Invariants and gotchas

- Active-profile flags come from `ProfileActivationService.getActivationStatus`; this context
  never calls `isFullyVerified()`/`canOperate()` for permissions.
- Controller resolves the caller's provider context (Professional or Company) in
  `resolveProviderContext`; both provider types must be supported in every provider-facing path.
- Interested providers get the limited view (`fromEntityLimited`): no client contact/address until
  assigned.
- Request status changes triggered by WhatsApp replies happen in
  `RequestInteractionRespondedHandler`, not inside `RequestInteractionService`.
- Cron jobs assume a single instance (no distributed lock).
- `FollowUpSchedulerJob.forceTriggerRule` (admin "trigger now") deliberately **bypasses the
  time-gate instead of backdating the request**: it validates the rule's non-time condition
  against the request's real current state (status for `BY_STATUS` rules, reusing
  `buildPayload`'s "has interests" check for `PENDING_WITH_INTERESTS` rather than duplicating it)
  and skips only the `hasPendingFollowUp`/"<1 day since last interaction" cron-spam guards, which
  don't apply to an explicit human action. It never mutates `Request.updatedAt` or any other field
  to make the request artificially "old enough".

## Tests

`request.service.spec.ts`, `request-interest.service.spec.ts` (mock `ProfileActivationService`),
`follow-up-scheduler.job.spec.ts`, `admin-whatsapp.service.spec.ts`,
`local-whatsapp.adapter.spec.ts`, `whatsapp-messaging.factory.spec.ts`,
`whatsapp-dev-mode.spec.ts`, `admin-whatsapp.controller.spec.ts`,
`admin-whatsapp-dev.controller.spec.ts`. Factory: `createMockRequest`. Manual WhatsApp scripts
under `test/scripts/whatsapp`.
