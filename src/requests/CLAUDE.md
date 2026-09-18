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
  `createFollowUp`. `processInboundMessage` is a thin orchestrator over four private methods
  (`matchInboundMessage`, `classifyInboundReply`, `applyClassificationSideEffects`,
  `buildRespondedInteraction` - each unit-tested individually) that: matches the inbound message
  against a pending automated `FOLLOW_UP` interaction within `WHATSAPP_REPLY_MATCH_WINDOW_DAYS`
  days (`RequestInteractionRepository.findMostRecentByPhone`, which explicitly filters
  `interactionType: FOLLOW_UP` - see "Ruteo de mensajes entrantes" in
  `docs/guides/whatsapp/README.md`); when nothing matches and
  `SUPPORT_CONVERSATIONS_ENABLED=true`, forks to `SupportConversationService.receiveInboundMessage`
  (Support context) instead of the previous silent drop; otherwise classifies the reply via
  `IntentDetectionPort` (LLM, with a keyword-matching fallback on timeout/error) instead of calling
  `DetectResponseIntentUseCase` directly — see "AI reply classification" below.
- `AdminWhatsAppService`: `isDevMode`, `getConfig`, `listConversations`, `getThread`,
  `simulateReply` (dev mode only), `triggerFollowUp` (dev mode only). Backs the admin WhatsApp
  conversations viewer; see `docs/guides/whatsapp/README.md`.
- `AdminRequestAttentionService`: `listOpen({page, limit})`, `resolve(id, adminUserId)`. Backs the
  admin "needs attention" panel (`RequestAttentionFlag`) — see "Admin request attention" below.

## Endpoints (`/requests`, all JWT)

`POST /` create, `GET /` mine (client + provider views), `GET /available` job board,
`GET /interested` my interests, `GET /:id`, `PATCH /:id`, `POST|DELETE /:id/photos`,
`POST|DELETE|GET /:id/interest`, `GET /:id/interests` (owner), `POST /:id/assign-provider`,
`POST /:id/unassign-provider`, `POST /:id/rate-client`. Webhook: `POST /webhooks/twilio`
(`TwilioWebhookGuard` + `TwilioRateLimitGuard`, no JWT).

Admin (`/admin/whatsapp`, `JwtAuthGuard` + `AdminGuard`): `GET config`, `GET conversations`,
`GET conversations/:requestId` always registered (`AdminWhatsAppController`); `POST
conversations/:requestId/simulate-reply` and `POST conversations/:requestId/trigger-followup`
live in a separate `AdminWhatsAppDevController`, registered only when `NODE_ENV !== 'production'`
OR `WHATSAPP_DEV_MODE_ENABLED=true` (pre-launch opt-in for the "production" Fly deploy, see
below), and additionally 404 (not 403) at runtime unless `isWhatsAppDevMode()` is true.

Admin (`/admin/requests/attention`, `JwtAuthGuard` + `AdminGuard`,
`AdminRequestAttentionController`): `GET ?page=&limit=` paginated list of open
`RequestAttentionFlag`s joined with request title/status; `POST /:id/resolve` (204). Read-only
otherwise — the admin follows up manually via the WhatsApp conversations viewer above; see "Admin
request attention" below.

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
  PENDING 3d with interests -> client (assign). Registered via `FOLLOW_UP_RULES` factory in the
  module. When the highest-`days` `BY_STATUS` rule for a request's current status fires and the
  request has never had a `RESPONDED` interaction (`RequestInteractionRepository.hasRespondedInteraction`),
  `FollowUpSchedulerJob` flags it `AT_RISK` via `RequestAttentionService` (see "Admin request
  attention" below) — `PENDING_WITH_INTERESTS` is excluded from this check.
- `RequestAttentionFlag` (association store, `domain/entities/request-attention-flag.entity.ts`):
  `id, requestId, reason (AT_RISK|ABANDONED|ESCALATED), detail?, createdAt, resolvedAt?,
  resolvedByUserId?`. Created only through `RequestAttentionService.flag(requestId, reason,
  detail?)`, which is idempotent — skips creating a duplicate or renotifying while an open flag
  with the same `(requestId, reason)` already exists (the follow-up ladder can keep re-triggering
  roughly daily for a stalled request). Two producers: `FollowUpSchedulerJob` (silence-based
  `AT_RISK`, see above) and `RequestInteractionService.processInboundMessage` (LLM-detected
  `escalate` -> `ESCALATED`, `viability === 'ABANDONED'` -> `ABANDONED`). Publishes
  `RequestAttentionFlaggedEvent`, consumed by `RequestAttentionFlaggedHandler` **in the
  notifications context** (not here — mirrors `RequestsNotificationsHandler`'s existing
  cross-context pattern rather than importing `NotificationsModule` into `RequestsModule`), which
  fans the notification out to every admin via `UserService.findAdminUserIds()`.

## Infrastructure

`PrismaRequestRepository` (`fullInclude` with client, provider -> professional|company -> user,
trade), `PrismaRequestQueryRepository` (stats/admin), `PrismaRequestInteractionQueryRepository`
(admin conversations list, one row per request with >=1 interaction; `search` is pushed into
Prisma's `groupBy` only when absent, otherwise fetched unfiltered and filtered in memory - see the
comment in the file), `PrismaRequestInterestRepository`, `PrismaRequestInteractionRepository`.
`WHATSAPP_MESSAGING_PORT` is provided by `shared/infrastructure/messaging/whatsapp-messaging.factory.ts`
(promoted there from this context so the `support` context can also send WhatsApp messages, mirrors
`email-sender.factory.ts`): `TwilioWhatsAppAdapter` by default, or `LocalWhatsAppAdapter` (no
network call, `local-<uuid>` message ids) when `WHATSAPP_PROVIDER=local`. `WHATSAPP_PROVIDER`
defaults to `twilio` so production can never silently go fake; `isWhatsAppDevMode()`
(`application/services/whatsapp-dev-mode.ts`) additionally requires `NODE_ENV !== 'production'`
(or the explicit `WHATSAPP_DEV_MODE_ENABLED=true` override) and gates the dev-only admin
endpoints (see `docs/guides/whatsapp/README.md`).
Jobs: `FollowUpSchedulerJob` (hourly; also exposes `forceTriggerRule(ruleName, requestId)` for the
admin "trigger now" endpoint), `WhatsAppDispatchJob` (1 min), `MessageStatusCheckerJob`
(5 min); flags `WHATSAPP_FOLLOWUP_ENABLED`, `WHATSAPP_STATUS_CHECK_ENABLED`.

**AI reply classification**: `INTENT_DETECTION_PORT` (`domain/ports/intent-detection.port.ts`) is
provided by `intent-detection.factory.ts` (mirrors `whatsapp-messaging.factory.ts`), switching on
`INTENT_CLASSIFIER_PROVIDER`: `LocalIntentDetectionAdapter` (default — wraps the existing
`DetectResponseIntentUseCase` keyword matching, no network, `viability`/non-explicit `optOut`
always the safe default) or `AnthropicIntentDetectionAdapter` (forced tool use, never free-text
parsing; short per-request timeout + `maxRetries: 0`, since it runs inside the synchronous Twilio
webhook path). Unlike `WHATSAPP_PROVIDER`, this one **defaults to `local`, not the real
adapter** — deliberately inverted, because silently calling a paid third-party LLM on every
inbound webhook in an unconfigured environment is a worse failure mode than degrading to keyword
matching (see the factory's doc comment). `RequestInteractionService` wraps the port call in a
`Promise.race` against `INTENT_CLASSIFIER_TIMEOUT_MS` and falls back to
`DetectResponseIntentUseCase` directly on timeout/error; below `INTENT_CLASSIFIER_CONFIDENCE_THRESHOLD`,
the classified `statusIntent` is downgraded to `UNKNOWN` before it ever reaches
`RequestInteractionRespondedEvent` (the raw classification stays in `interaction.metadata` for
auditing). See `docs/guides/ENVIRONMENT_VARIABLES.md` for the env vars.

**Admin request attention**: `REQUEST_ATTENTION_FLAG_REPOSITORY` / `PrismaRequestAttentionFlagRepository`
(association store) and `REQUEST_ATTENTION_QUERY_REPOSITORY` / `PrismaRequestAttentionQueryRepository`
(admin listing read model, `AttentionFlagSummary`) back `RequestAttentionFlag`. See the Domain
section above for the flagging flow.

## Invariants and gotchas

- Active-profile flags come from `ProfileActivationService.getActivationStatus`; this context
  never calls `isFullyVerified()`/`canOperate()` for permissions. `User.whatsappOptedOut` is
  gated into that same computation (Profiles context) so an opted-out user can't create/take new
  requests; this context additionally checks `whatsappOptedOut` directly in
  `RequestInteractionService.getRecipientPhone` (refuses to return a phone, reusing the "no
  verified phone -> `FAILED`" path) and in `FollowUpSchedulerJob.canReceiveFollowUp`, so
  already-assigned requests simply stop receiving WhatsApp for that person (they are never
  auto-cancelled/unassigned).
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
`prisma-request-interaction.repository.spec.ts` (asserts the actual Prisma `where` clause includes
`interactionType: FOLLOW_UP` - this repo's first repository-level spec, added specifically to
protect that invariant), `whatsapp-dev-mode.spec.ts`, `admin-whatsapp.controller.spec.ts`,
`admin-whatsapp-dev.controller.spec.ts`. Factory: `createMockRequest`. Manual WhatsApp scripts
under `test/scripts/whatsapp`.

AI classifier / attention flags: `detect-response-intent.use-case.spec.ts`,
`local-intent-detection.adapter.spec.ts`, `anthropic-intent-detection.adapter.spec.ts` (mocks
`@anthropic-ai/sdk`, never hits the network), `intent-detection.factory.spec.ts`,
`request-interaction.service.spec.ts` (fallback-on-timeout, confidence downgrade, opt-out,
attention flagging, staleness window, support fork on/off, plus a dedicated describe block unit-
testing each extracted `processInboundMessage` method), `request-interaction-responded.handler.spec.ts`,
`request-attention.service.spec.ts` (idempotency), `request-attention-flagged.handler.spec.ts`
(in `src/notifications/application/handlers/`). Cross-context: `user.service.spec.ts`
(`findAdminUserIds`/`setWhatsAppOptedOut`), `profile-activation.service.spec.ts` (opt-out gate).
