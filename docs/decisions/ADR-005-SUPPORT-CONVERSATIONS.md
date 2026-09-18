# ADR-005: Support Conversations as a Separate Bounded Context

**Status:** Accepted
**Date:** September 2026
**Decision Makers:** Development Team

## Context

All WhatsApp traffic was modeled as `RequestInteraction` (`src/requests/`): a templated,
request-scoped follow-up automation ledger that feeds an LLM/keyword intent classifier
(`IntentDetectionPort`), whose output can change `Request.status`
(`RequestInteractionRespondedHandler`). When an inbound WhatsApp message didn't match any pending
automated follow-up, it was silently dropped —
`RequestInteractionService.processInboundMessage` logged a warning and returned, with nothing
persisted and no one notified.

Investigating that bug surfaced a broader, deliberate product decision: WhatsApp should also work
as a general support/conversation channel — including messages unrelated to any `Request` — with
an admin able to reply from the admin portal, respecting the real 24h reply window WhatsApp
Business API enforces (which nothing in this codebase tracked before this change).

Two designs were considered for the fix:

1. **Extend `RequestInteraction`** to also represent free-form support messages (e.g. a nullable
   `requestId`, a new `InteractionType`).
2. **A new, structurally separate bounded context** (`support`) that never feeds the intent
   classifier.

Option 1 was rejected: `RequestInteraction`'s entire reason for existing is to drive automated
status transitions from classified replies. Mixing in human-authored, non-automated conversation
risks the classifier interpreting a support reply as a signal to change `Request.status` — a
correctness/safety concern, not just an organizational one. `InteractionType.RESPONSE` and
`STATUS_UPDATE` already exist in the schema as unused/dead enum values from an earlier, abandoned
attempt at something similar; they were confirmed dead and are deliberately *not* resurrected by
this change.

## Decision

1. **New bounded context `support`** (`src/support/`), structurally independent of `requests`:
   it imports `requests`' domain nowhere, and `requests` only imports `support`'s exported
   **service** (`SupportConversationService`), never the reverse. This one-directional dependency
   means the intent classifier in `requests` can never run on a `support` message, by
   construction — not by convention.

2. **Two aggregates**, mixing the two persistence patterns already used elsewhere in this repo
   (see ADR-002-DDD-PERSISTENCE-BOUNDARIES):
   - `SupportConversationEntity` — a real aggregate (`save(entity)`), one row per phone number,
     with an `OPEN`/`RESOLVED` state machine and the WhatsApp 24h reply-window check
     (`isWithinReplyWindow`).
   - `SupportMessageEntity` — an append-only association store (`add`/`findByConversationId`),
     same pattern as `ContactRepository`. No `PENDING`/`SENT`/`FAILED` lifecycle like
     `RequestInteraction`: an admin's reply is sent synchronously through the messaging port, and
     on failure nothing is persisted (an accepted v1 simplification — see "Consequences" below).

3. **No real foreign keys for `userId`/`relatedRequestId`** on `SupportConversation`. Both are
   soft references (plain `String?` columns, no `@relation`), resolved best-effort
   (`UserService.findByPhone`) or left `null`. This is the same pattern domain event payloads
   already use (ids without a DB relation) and is what keeps `support` from depending on
   `identity`/`requests` at the schema level, not just the module level.

   ✅
   ```prisma
   model SupportConversation {
     userId           String?   // no @relation
     relatedRequestId String?   // no @relation
   }
   ```
   ❌
   ```prisma
   model SupportConversation {
     userId    String?
     user      User? @relation(fields: [userId], references: [id])
   }
   ```

4. **The `WhatsAppMessagingPort` (and its Twilio/local adapters) moved from `requests/` to
   `shared/infrastructure/messaging/`.** It was already provider-agnostic (plain
   `sendMessage(to, message)`, no template coupling at the port level); the only reason it lived
   under `requests/` was history. Promoting it lets `support` send WhatsApp messages without
   creating a dependency on `requests`. This was executed as its own isolated commit, verified
   behavior-neutral (`npm test` green, same assertions, only import paths changed) before any
   `support` code depended on it.

5. **Inbound routing invariant, enforced at the query level.** A message can only be treated as a
   reply to something `requests` automatically sent — `RequestInteractionRepository.findMostRecentByPhone`
   now explicitly filters `interactionType: InteractionType.FOLLOW_UP` in its Prisma `where`
   clause (previously this was only true by coincidence: no other `interactionType` was ever
   created, but the query didn't enforce it). This is documented as a deliberate invariant on the
   repository interface, not left as an implementation detail, and has a dedicated
   repository-level test asserting the actual query shape.

6. **Rollout is flag-gated.** `SUPPORT_CONVERSATIONS_ENABLED` (default `false`) gates the fork in
   `RequestInteractionService.processInboundMessage`; with it off, behavior is unchanged from
   before this ADR (log + drop). `WHATSAPP_REPLY_MATCH_WINDOW_DAYS` (default `14`) bounds how far
   back an automated follow-up can still be replied to.

## Consequences

### Positive

- The intent classifier can never see a support conversation message — a structural guarantee,
  not a runtime check that could be forgotten in a future change.
- `RequestInteraction`'s schema and semantics stay untouched; no migration risk to the existing
  follow-up automation.
- The messaging port promotion is a net simplification: one `WHATSAPP_MESSAGING_PORT` shared by
  both contexts instead of a second one duplicated for `support`.
- The original bug (silent drop) is fixed, with an explicit, reversible rollout flag.

### Negative / Tradeoffs

- Two contexts now both talk about "a WhatsApp message" with different entities
  (`RequestInteraction` vs. `SupportMessage`) — some conceptual duplication is inherent to keeping
  them structurally separate. Mitigation: the shared messaging port and template service are the
  only infrastructure genuinely common to both; nothing else is factored out prematurely.
- `userId`/`relatedRequestId` without FKs means the database can't enforce referential integrity
  for these soft links, and a stale/dangling id is possible if a `User` is deleted (not currently
  supported anywhere in this codebase, so low risk today). Mitigation: both fields are optional
  and only used for UI convenience (linking to a user/request from the admin panel), never for
  authorization or business logic.
- If an admin's outbound reply fails after `WhatsAppMessagingPort.sendMessage` throws, nothing is
  persisted — there's no audit trail of the attempted send. Explicitly deferred (see
  `src/support/CLAUDE.md`'s "Explicitly out of scope" section); `RequestInteraction`'s
  PENDING/SENT/FAILED lifecycle was considered and rejected for v1 as unnecessary complexity for a
  synchronous, admin-initiated send.

## Architectural Fitness Function

`src/__tests__/architecture.spec.ts`'s existing three checks now also cover `support` (added to
`CONTEXTS`):
- No cross-context `domain/repositories`/`domain/queries` imports — `support` never imports
  `requests`' internals, and vice versa.
- `SupportModule` exports only `SupportConversationService`, never `SUPPORT_CONVERSATION_REPOSITORY`
  / `SUPPORT_MESSAGE_REPOSITORY`.
- `PrismaService` only appears in `support/infrastructure/{repositories,queries}`.

Manual review: confirm no file under `src/support/` imports anything from
`src/requests/domain/**`, and that `RequestInteractionRepository.findMostRecentByPhone`'s Prisma
implementation still hardcodes `interactionType: InteractionType.FOLLOW_UP` in its `where` clause.

## Affected Modules / Implementation Notes

| Area | Change |
|---|---|
| `prisma/schema.prisma` | New `SupportConversation`/`SupportMessage` models + `SupportConversationStatus`/`SupportMessageDirection` enums. No changes to `RequestInteraction`/`RequestAttentionFlag`. |
| `src/support/` | New bounded context (domain/application/infrastructure/presentation layers). |
| `src/shared/infrastructure/messaging/` | Now owns `WhatsAppMessagingPort` + adapters (moved from `src/requests/`). |
| `src/requests/application/services/request-interaction.service.ts` | `processInboundMessage` decomposed into named methods; forks to `SupportConversationService` when nothing matches and the flag is on. |
| `src/requests/domain/repositories/request-interaction.repository.ts` | `findMostRecentByPhone` takes an explicit `notOlderThan` cutoff; doc comment states the `FOLLOW_UP`-only invariant. |
| `src/notifications/application/handlers/support-conversation-attention-flagged.handler.ts` | New handler, `SUPPORT_CONVERSATION_NEEDS_ATTENTION` notification type. |
| `src/identity/` | `UserService.findByPhone` (best-effort, no unique constraint on `phone`). |

## References

- `docs/guides/whatsapp/README.md` — inbound routing (follow-up vs. support)
- `docs/decisions/ADR-002-DDD-PERSISTENCE-BOUNDARIES.md` — aggregate vs. association-store patterns
- `src/support/CLAUDE.md`
