# ADR-006: Request State Machine (15 States, Actor-Aware)

**Status:** Accepted
**Date:** September 2026
**Decision Makers:** Development Team

## Context

`Request.status` was a flat 5-value enum (`PENDING/ACCEPTED/IN_PROGRESS/DONE/CANCELLED`) that
could not express who owns the next action, why a request ended without completing, or when a
side should be nudged. Product wrote a full redesign spec —
[`docs/architecture/EspecialistBRC — Estados del pedido.md`](<./../architecture/EspecialistBRC — Estados del pedido.md>)
(moved into `docs/architecture/` alongside this ADR in the same change; keep that document as the
source of truth for the state table, transition diagram and WhatsApp templates instead of
duplicating them here) — built around three rules per state: a single owner of the ball, a single
exit action, and an expiry.

## Decision

1. Replace `RequestStatus` with a 15-value enum covering the main path (`DRAFT → PUBLISHED|SENT →
   CONTACT_RELEASED → IN_PROGRESS → FINISHED → CLOSED`, plus the support detour `UNDER_REVIEW`)
   and seven terminal alternates that end a request without reaching `CLOSED` (`EXPIRED`,
   `NO_RESPONSE`, `REJECTED`, `CANCELLED`, `NOT_COMPLETED`, `INTERRUPTED`, `ABANDONED`).
2. Give each `RequestInterest` (a specialist's expression of interest on a public/bolsa request)
   its own sub-state (`INTERESTED/CHOSEN/NOT_CHOSEN/WITHDRAWN`) instead of overloading the
   request's own status, so a public request with many interested providers doesn't need one
   status per provider.
3. Add a `Sistema` actor that applies time-based transitions (`RequestExpirationJob`): bolsa
   expiry, no-response expiry, post-contact abandonment, and auto-close on `FINISHED` timeout.
   Off by default via `REQUEST_EXPIRATION_ENABLED`.
4. Add a `Soporte` actor (modeled as `AdminGuard`-gated for now, no separate role) that resolves
   `UNDER_REVIEW` back to `CLOSED` via `POST /admin/requests/:id/resolve-review`.
5. Drive WhatsApp follow-up off the new states: 10 templates (`A1-A7` notices, `P1-P3` questions)
   plus per-state follow-up ladders, with question replies (`P1-P3`) mapped back onto state
   transitions in `RequestInteractionRespondedHandler`.
6. Gate counterpart contact info (phone/WhatsApp) behind `canViewCounterpartContactBy`, true only
   from `CONTACT_RELEASED` onward — closing two pre-existing contact-info leaks found while
   integrating this (interested-but-not-chosen providers' contact was visible before the client
   ever chose anyone; fixed in #66/#67).

```
✅ request.canChangeStatusBy(ctx, RequestStatus.IN_PROGRESS)   // domain method, actor-aware
❌ request.status = RequestStatus.IN_PROGRESS                  // no ownership/expiry check
```

## Consequences

### Positive
- Every state has one clear owner and one clear way out, matching the product spec directly —
  no more inferring "who should act next" from combinations of fields.
- Auto-expiry and WhatsApp follow-up have a single source of transition rules (the state itself)
  instead of being bolted on ad hoc per feature.
- Support has a first-class detour (`UNDER_REVIEW`) instead of silently getting stuck states.

### Negative / Tradeoffs
- No state-entry timestamp exists yet; follow-up ladders read "days since entering this state"
  off `Request.updatedAt`, which any unrelated save resets. Documented as a known limitation in
  PR4, not fixed — a real state-history log is the eventual fix.
- `IN_PROGRESS → ABANDONED` is intentionally unmapped (open question in the spec's own
  "Decisiones/Abiertas" section); a request stuck `IN_PROGRESS` just stops receiving reminders.
- The migration (PR1) truncates `requests` (cascading to interests/interactions/reviews/attention
  flags) instead of mapping old data onto the new enum. Acceptable because the app was pre-launch
  with no real data worth preserving (user explicitly approved wiping/reseeding); would not be
  acceptable post-launch.
- WhatsApp templates (`A1-A7`, `P1-P3`) still need approval in Meta/Twilio before they can be used
  for real traffic.

## Architectural Fitness Function

No new automated check — this is a domain enum + entity-method change, not a layering rule.
Manual review: any new transition must go through `RequestEntity.canChangeStatusBy(ctx, newStatus)`
(never assigned directly), and any new terminal/alternate state must be added to both the state
table in the spec doc and `request-status.metadata.ts` (single source for labels/badges/tab
bucket/timeline step/primary action, per `specialist-fe`'s mirrored `lib/request-status.ts`).

## Affected Modules / Implementation Notes

| Area | Files |
|---|---|
| Core enum + transitions | `prisma/schema.prisma`, `src/requests/domain/entities/request.entity.ts`, `request-status.metadata.ts` |
| Interest sub-states | `src/requests/domain/entities/request-interest.entity.ts` (PR2) |
| Auto-expiry | `src/requests/application/jobs/request-expiration.job.ts` |
| WhatsApp templates/ladders | `src/requests/application/follow-up/follow-up-ladders.ts`, `follow-up-variables.ts`, `message-templates.json` |
| Reply → state mapping | `src/requests/application/handlers/request-interaction-responded.handler.ts` |
| Support resolution | `POST /admin/requests/:id/resolve-review`, `src/requests/CLAUDE.md` |
| Contact gating | `canViewCounterpartContactBy` (fixed in #66, #67) |
| Frontend mirror | `specialist-fe`: `types/index.ts`, `lib/request-status.ts`, `lib/request-participants.ts`, `components/requests/request-timeline.tsx` (PR #20, separate repo) |

## References

- [`docs/architecture/EspecialistBRC — Estados del pedido.md`](<./../architecture/EspecialistBRC — Estados del pedido.md>) — full product spec (state table, transition diagram, "Quién puede mover cada cosa", WhatsApp rules/templates, open questions)
- PRs: specialist-be #59, #60, #61, #62, #63 (PR1-PR5), #65, #66, #67 — specialist-fe #20
- `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DOMAIN_MODEL.md`, `docs/API.md` (state list reference)
- `docs/guides/whatsapp/README.md` (follow-up system)
