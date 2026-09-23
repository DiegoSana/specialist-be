---
name: follow-ups
description: Domain knowledge for the WhatsApp follow-up system in specialist-be — ladders (P1-P3 question ladders vs A1-A7 notices), the scheduler job, response-intent detection that can move a Request's status, feature flags, and Twilio/Meta gotchas. Use whenever a task touches WhatsApp messages tied to a request, follow-up timing/templates, or "por qué no llegó el WhatsApp". Read [[request-flow]] first if the task also involves which RequestStatus values exist — ladders take status as input and this skill assumes you already know the state machine.
---

# follow-ups

Domain map for how/when a Request gets a WhatsApp follow-up sent, and how a reply can move its
status. Not a how-to — for adding/changing a rule step by step, use `specialist-be`'s own
`add-follow-up-rule` skill once you're working inside that repo; this one is the "what already
exists and how it fits together" context to read first. Companion to [[request-flow]]: ladders are
keyed on `RequestStatus`, so if the task also touches which statuses exist or their transitions,
read that skill too.

## Two kinds of rules, one scheduler

`src/requests/application/jobs/follow-up-scheduler.job.ts` runs on a cron and drives both:

- **Ladders** (`src/requests/application/follow-up/follow-up-ladders.ts`, `FOLLOW_UP_LADDERS`)
  — the preferred, declarative path. Each `LadderDef` is `{status, directions, template, days[],
  ...}`; the scheduler owns ordering, the max-3-per-ladder cap, and per-recipient dedup. Per
  `docs/architecture/EspecialistBRC — Estados del pedido.md`'s "Follow-up por WhatsApp: reglas por
  estado" table: **P1-P3 are the only ladders whose reply can move a request's state** (question
  ladders); **A1-A7 are notices** — the user acts in the app, not by replying. Day counts in code
  are proposals, not final.
- **Legacy rule classes** (`application/follow-up/rules/`, `StatusFollowUpRule` /
  `AbstractFollowUpRule`) — only for payloads a ladder can't express (custom
  `buildPayload`/variables). Prefer a ladder entry for anything new.

Candidate selection for either kind goes through `FollowUpQuery`
(`domain/follow-up/follow-up-query.ts`: `BY_STATUS {status, days}` or
`PENDING_WITH_INTERESTS {days}`), executed by `follow-up-query-executor.ts` against
`RequestRepository`.

## Guards the scheduler already applies (don't reimplement in a rule)

Skips a send when: a follow-up for that request is already `PENDING`, there was an interaction
< 1 day ago, the recipient has no verified phone, or `WHATSAPP_FOLLOWUP_ENABLED !== 'true'`
(off means no sends at all — check this first when "no llegó el WhatsApp" and nothing else looks
wrong).

## Reply → status transition path

A provider/client reply is a `RequestInteractionResponded` event
(`domain/events/request-interaction-responded.event.ts`) →
`DetectResponseIntentUseCase` (`application/use-cases/detect-response-intent.use-case.ts`)
classifies the reply against known keywords → `request-interaction-responded.handler.ts` maps the
detected intent to a status transition. Only replies to P1-P3 templates are wired to move status;
extending what a reply can do means adding keywords here **and** the transition map in the
handler — a template alone doesn't do anything.

## Templates & messaging infra (shared with `support`, not requests-only)

- Templates: `src/shared/infrastructure/messaging/message-templates.json` — Spanish (es-AR,
  "vos"), `{{variable}}` placeholders resolved by `MessageTemplateService`. End templates that
  expect a reply with the expected reply options.
- Transport: `WhatsAppMessagingPort` (`shared/domain/ports/whatsapp-messaging.port.ts`) →
  `TwilioWhatsAppAdapter` (`shared/infrastructure/messaging/twilio-whatsapp.adapter.ts`). This
  port is shared with the `support` context (general WhatsApp support channel, independent of any
  Request — see `src/support/CLAUDE.md`) — a transport-level change (adapter, factory) affects
  both, not just requests.
- Don't fire real Twilio in tests; the port is mocked (`.claude/rules/05-events-jobs-notifications.md`
  has the notification/job testing conventions).

## Where follow-up state is visible

- `specialist-admin`: `app/admin/whatsapp/page.tsx` (list) and `app/admin/whatsapp/[requestId]/`
  (per-request conversation view) — this is currently the only UI into follow-up
  interactions; `specialist-fe` doesn't surface follow-up history to end users.
- Manual end-to-end check: `npm run whatsapp:test scheduler` against a running dev app with the
  Twilio sandbox — see `test/scripts/whatsapp/README.md`.

## Known gaps / gotchas

- **Templates need Meta/Twilio approval before they work for real sends** — a template existing
  in code and being "approved" are different things; check before assuming a new ladder will
  actually deliver outside the sandbox.
- **No state-entry timestamp.** Day counts (`days: [...]` in a `LadderDef`) are proxied by
  `Request.updatedAt`, which *any* unrelated save resets (e.g. someone editing an unrelated field
  restarts the ladder clock). This is a known, documented limitation from the rollout — not
  something to silently "fix" without checking with the user first, since a real fix needs a new
  column + migration.
- `REQUEST_EXPIRATION_ENABLED` (separate flag, `Sistema` actor / `RequestExpirationJob`, runs
  hourly at :30) is off by default in prod so deploys don't auto-close requests before plazos are
  agreed — don't confuse it with `WHATSAPP_FOLLOWUP_ENABLED`, they gate different jobs.
- Docs table of rules: `docs/guides/whatsapp/README.md` — update it when adding/changing a ladder
  or rule, it's the canonical list of what's live.
