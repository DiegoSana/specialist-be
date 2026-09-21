---
name: add-follow-up-rule
description: Add or modify a WhatsApp follow-up rule in the requests context (strategy class, FollowUpQuery/repository method, message template, module registration, tests, docs). Use when asked to "send a WhatsApp after N days when status is X" or to change follow-up timing/templates.
---

# add-follow-up-rule

Read `docs/guides/whatsapp/README.md` and `.claude/rules/05-events-jobs-notifications.md` first.

1. **Template**: add a key to `src/shared/infrastructure/messaging/message-templates.json`
   (Spanish es-AR, "vos"; `{{variable}}` placeholders resolved by `MessageTemplateService`). Keep
   the message short and end with the expected reply options when a response is expected.
2. **Query**: if the candidate selection is not expressible with the existing `FollowUpQuery`
   union (`src/requests/domain/follow-up/follow-up-query.ts`: `BY_STATUS {status, days}` or
   `PENDING_WITH_INTERESTS {days}`), add a variant there, add a `findX...UpdatedBefore(...)`
   method to `RequestRepository` (+ `PrismaRequestRepository`), and map it in
   `src/requests/application/follow-up/follow-up-query-executor.ts`.
3. **Rule**: preferred path = add a `LadderDef` entry to `src/requests/application/follow-up/follow-up-ladders.ts` (status, directions, template, days; max 3; optional `appliesTo`/`escalatesWhenUnanswered`); the ladder guards (order, max 3, per-recipient) are applied by the scheduler. Only write a custom class as below for payloads a ladder can't express. Legacy class form: in `src/requests/application/follow-up/rules/<status>-<n>-days.follow-up-rule.ts`:
   - Status-based: extend `StatusFollowUpRule` and call
     `super('<NAME>', RequestStatus.X, <days>, InteractionDirection.TO_PROVIDER|TO_CLIENT, '<template_key>')`.
   - Custom payload/variables: extend `AbstractFollowUpRule` and implement `buildPayload(request)`
     returning `{ metadata, templateVariables }` (see `pending-3-days-with-interests`).
   - Export from `rules/index.ts`.
4. **Register** in `src/requests/requests.module.ts`: add to `providers` and to the
   `FOLLOW_UP_RULES` factory (both `useFactory` params and `inject`).
5. **Guards the scheduler already applies** (do not duplicate in the rule): skip when a follow-up
   for the request is already PENDING, when there was an interaction < 1 day ago, when the
   recipient has no verified phone, and when `WHATSAPP_FOLLOWUP_ENABLED !== 'true'`.
6. **Response handling**: if the new message expects replies that should change request status,
   extend `DetectResponseIntentUseCase` keywords and the transition map in
   `request-interaction-responded.handler.ts`.
7. **Tests**: unit test the rule (`getQuery`, `getTemplate`, `buildPayload`) and, if a repository
   method was added, extend the repository mock lists in `request.service.spec.ts` /
   `request-interest.service.spec.ts`. Manual check: `npm run whatsapp:test scheduler` against a
   running dev app with the Twilio sandbox (see `test/scripts/whatsapp/README.md`).
8. **Docs**: rules table in `docs/guides/whatsapp/README.md`.
