# Support context (`src/support`)

General WhatsApp support/conversation channel, independent of any `Request`. Exists specifically
to keep free-form human conversation away from the `requests` context's LLM/keyword intent
classifier: a message that lands here can never change `Request.status`, by construction (this
context has no dependency on `requests` domain internals - only soft-referenced ids). See
`docs/guides/whatsapp/README.md` and `docs/decisions/ADR-005-SUPPORT-CONVERSATIONS.md` for the
full rationale.

## Public API (exported by `SupportModule`)

`SupportConversationService`: `receiveInboundMessage({ phoneNumber, body, twilioMessageSid })`
(entry point from `RequestInteractionService.processInboundMessage` when an inbound WhatsApp
message doesn't match any pending automated follow-up - see `requests/CLAUDE.md`),
`hasOpenConversation(phoneNumber)` (used by `FollowUpSchedulerJob`: while a phone has an OPEN conversation, automated follow-ups to it are skipped and retried by the hourly cron once it is resolved; `forceTriggerRule` bypasses it), `listForAdmin({ status?, page, limit })`, `getForAdmin(id)`, `replyForAdmin(id, adminUserId,
message)`, `resolve(id, adminUserId)`, `reopen(id)`.

## Endpoints (`/admin/support/conversations`, `JwtAuthGuard` + `AdminGuard`)

`GET ?status=OPEN|RESOLVED|ALL&page=&limit=` -> `{ data, meta }`, each item including
`canReplyNow` computed server-side (`SupportConversationEntity.isWithinReplyWindow(now)`).
`GET /:id` -> `{ conversation, messages }` (messages chronological, oldest first - unlike
`AdminWhatsAppController.getThread`, which is newest-first). `POST /:id/reply` (body: `message`,
1-1500 chars) -> 201 with the created message, or 400 `{ code: 'WHATSAPP_WINDOW_EXPIRED', message,
lastInboundAt }` outside the 24h WhatsApp reply window. `POST /:id/resolve` / `POST /:id/reopen`
-> 204, both idempotent.

## Domain

Two aggregates, deliberately mixing the two persistence patterns already used elsewhere in this
repo:

- `SupportConversationEntity` (real aggregate, `save(entity)`): one row per phone number
  (`phoneNumber` unique). State machine `OPEN`/`RESOLVED`. `userId`/`relatedRequestId` are soft
  references - no Prisma FK - resolved best-effort (`UserService.findByPhone`) or set later; this
  context never depends structurally on `identity`/`requests` at the schema level. Key methods:
  `createFromInboundMessage`, `recordInboundMessage(now)` (returns `{ conversation, reopened }` -
  `reopened` is true only on `RESOLVED -> OPEN`, the signal the service uses to decide whether to
  publish the attention event), `recordOutboundMessage(now)`, `resolve(adminUserId, now)` /
  `reopen(now)` (both idempotent - resolving an already-resolved or reopening an already-open
  conversation is a no-op), `isWithinReplyWindow(now)` (hardcoded 24h WhatsApp Business API limit,
  strictly-less-than at the boundary).
- `SupportMessageEntity` (association store, same pattern as `ContactRepository`): `add`,
  `findByConversationId` (chronological), `findByTwilioMessageSid` (idempotency). No
  PENDING/SENT/FAILED lifecycle like `RequestInteraction` - an admin's outbound send is synchronous
  through `WhatsAppMessagingPort`; on failure nothing is persisted (accepted v1 simplification, see
  "Explicitly out of scope" below).
- No `canXxxBy(ctx)` on either entity - this context has no authenticated end-user surface, only
  `AdminGuard`-protected admin routes.
- Event: `SupportConversationAttentionFlaggedEvent`
  (`support.conversation.attention_flagged`), published by `SupportConversationService` only when
  `recordInboundMessage` reports `reopened: true` or the conversation is brand new - never on
  message 2..N of an already-OPEN conversation. Consumed by
  `SupportConversationAttentionFlaggedHandler` in the notifications context.

## Infrastructure

`PrismaSupportConversationRepository` / `PrismaSupportMessageRepository`, mappers in
`infrastructure/mappers/`. `SUPPORT_CONVERSATION_REPOSITORY` / `SUPPORT_MESSAGE_REPOSITORY` DI
tokens, not exported by `SupportModule` (only `SupportConversationService` is). Sends WhatsApp
replies through `WHATSAPP_MESSAGING_PORT` (`shared/infrastructure/messaging/`, promoted there from
`requests/` specifically so this context doesn't depend on `requests`).

## Invariants and gotchas

- `receiveInboundMessage` is idempotent on `twilioMessageSid` (checked against
  `SupportMessageRepository.findByTwilioMessageSid` before doing anything else) - a retried Twilio
  webhook delivery is a no-op.
- Phone -> user resolution (`UserService.findByPhone`, no unique constraint on `User.phone`) is
  best-effort and wrapped so it can never block conversation creation: any failure just leaves
  `userId: null`.
- Routing here happens inside `RequestInteractionService.processInboundMessage`
  (`requests/application/services/request-interaction.service.ts`), gated by
  `SUPPORT_CONVERSATIONS_ENABLED` (default `false`) - `requests` imports `SupportModule`, never the
  other way around, so there is no module cycle.
- `replyForAdmin` checks `isWithinReplyWindow` itself (not just relying on the controller) before
  ever calling the messaging port, since Twilio/Meta would reject a free-text send outside the
  window anyway.

## Explicitly out of scope (v1)

Auditing failed admin sends (nothing is persisted if the outbound send throws), an endpoint to
manually link a conversation to a `Request`, rate limiting beyond `AdminGuard`, assigning
conversations to a specific admin, canned replies/templates, automatic close-on-inactivity, read
receipts. See the design doc referenced above for the full list.

## Tests

`support-conversation.entity.spec.ts`, `support-message.entity.spec.ts`,
`support-conversation.service.spec.ts` (idempotency, notify-on-create/reopen but not on repeat
inbound, reply-window gate, resolve/reopen idempotency). Cross-context:
`request-interaction.service.spec.ts` (fork on no match, flag on/off, staleness window,
`interactionType: FOLLOW_UP` invariant), `user.service.spec.ts` (`findByPhone`),
`support-conversation-attention-flagged.handler.spec.ts` (in
`src/notifications/application/handlers/`).
