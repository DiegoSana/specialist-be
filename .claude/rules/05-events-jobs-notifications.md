---
paths:
  - "src/**/domain/events/**"
  - "src/**/application/handlers/**"
  - "src/**/application/jobs/**"
  - "src/notifications/**"
  - "src/shared/infrastructure/events/**"
  - "src/shared/infrastructure/messaging/**"
---

# Domain events, handlers, jobs and notifications

Source of truth: `docs/guides/NOTIFICATIONS.md`, `docs/decisions/ADR-003-NOTIFICATIONS-DELIVERY-RETRY-RETENTION.md`,
`docs/guides/whatsapp/README.md` (authoritative for WhatsApp; `docs/plans/whatsapp-followup-implementation-status.md` is stale).

## Domain events

- Class per event in `<context>/domain/events/<aggregate>-<verb>.event.ts` implementing
  `DomainEvent<TPayload>` from `shared/domain/events/domain-event.ts`, with
  `public static readonly EVENT_NAME = '<context>.<aggregate>.<past_tense>'`
  (e.g. `requests.request.status_changed`, `reputation.review.approved`).
- Payloads are plain serializable objects with ids and display names, never entities. Provider
  events carry `serviceProviderId`, `providerUserId` (the user to notify), `providerType`,
  `providerName` (+ deprecated `professionalId`).
- Publish from the application service AFTER the repository `save` succeeds:
  `await this.eventBus.publish(new XEvent({...}))` via `@Inject(EVENT_BUS) eventBus: EventBus`.
- The bus is `InMemoryEventBus` (in-process, fire-and-forget, `EventsModule` is `@Global`).
  Handlers subscribe in `onModuleInit()` with `this.eventBus.on(XEvent.EVENT_NAME, handler)` and
  must guard `typeof this.eventBus?.on !== 'function'`. Handler errors are logged, never rethrown
  into the publisher. There is no persistence/outbox: a crash between save and publish loses the
  event (accepted for now).
- Cross-context side effects (notifications, status changes triggered by WhatsApp replies) go
  through handlers, not through direct service calls from the emitting context.

## Notifications context

- `NotificationService.createForUser({ userId, type, title, body, data, idempotencyKey, includeExternal, requireExternal })`
  creates a `Notification` (intent) plus one `NotificationDelivery` per channel
  (`IN_APP`, and `EMAIL` or `WHATSAPP` per user preferences). In-app read state is
  `deliveries[IN_APP].readAt`; never add a `read` flag on the notification.
- Types in use: `REQUEST_STATUS_CHANGED`, `REQUEST_INTEREST_EXPRESSED`, `REQUEST_PROFESSIONAL_ASSIGNED`,
  `REVIEW_APPROVED`. Add new types as string constants and document them in NOTIFICATIONS.md.
- Titles/bodies are user-facing Spanish (es-AR, "vos"). Use `idempotencyKey` for anything a retry
  or duplicate event could re-emit.
- Delivery: `NotificationDispatchJob` (`*/1 * * * *`) polls pending deliveries
  (`NotificationDeliveryQueue` port), sends through `EmailSender` port (`smtp` default or
  `mailgun` via `EMAIL_PROVIDER`), applies exponential backoff with `attemptCount/nextAttemptAt`,
  marks `FAILED` at `NOTIFICATIONS_DISPATCH_MAX_ATTEMPTS`. `NotificationRetentionJob`
  (`15 3 * * *`) deletes notifications older than `NOTIFICATIONS_RETENTION_DAYS` (default 90).

## Jobs (`@Cron` in `application/jobs/`)

| Job | Schedule | Flag |
|---|---|---|
| `FollowUpSchedulerJob` (requests) | hourly | `WHATSAPP_FOLLOWUP_ENABLED` |
| `WhatsAppDispatchJob` (requests) | every minute | `WHATSAPP_FOLLOWUP_ENABLED` |
| `MessageStatusCheckerJob` (requests) | every 5 min | `WHATSAPP_STATUS_CHECK_ENABLED` |
| `NotificationDispatchJob` | every minute | `NOTIFICATIONS_DISPATCH_ENABLED` |
| `NotificationRetentionJob` | 03:15 daily | retention days env |

Rules: check the flag first and return early; be idempotent (re-running must not duplicate work);
catch per-item errors and continue; log a summary. Scheduling (creating PENDING work) and dispatch
(sending) are separate jobs; never send from a scheduler. Jobs assume a single instance (no
distributed lock); do not add multi-instance assumptions without adding leasing.

## WhatsApp follow-up (requests context)

- Rules are strategy classes in `requests/application/follow-up/rules/` extending
  `AbstractFollowUpRule`/`StatusFollowUpRule`, registered in the `FOLLOW_UP_RULES` factory in
  `requests.module.ts`. Each rule declares name, `FollowUpQuery`, direction (`TO_CLIENT|TO_PROVIDER`)
  and a template key from `shared/infrastructure/messaging/message-templates.json`. Use the
  `add-follow-up-rule` skill.
- Follow-ups only target assigned requests (or the explicit PUBLISHED-with-interests rule); skip if
  a follow-up is already pending or an interaction happened < 1 day ago; recipient must have a
  verified phone.
- Outbound goes through the `WhatsAppMessagingPort` (`TwilioWhatsAppAdapter`), never the Twilio
  SDK directly; the shared `TwilioClientService` is the single Twilio client.
- Inbound: `POST /api/webhooks/twilio` -> `TwilioWebhookGuard` (signature) + `TwilioRateLimitGuard`
  -> `RequestInteractionService.processInboundMessage` -> `DetectResponseIntentUseCase` ->
  `RequestInteractionRespondedEvent` -> `RequestInteractionRespondedHandler` changes request status
  (CONFIRMED: SENT->CONTACT_RELEASED, STARTED: CONTACT_RELEASED->IN_PROGRESS, COMPLETED: IN_PROGRESS->FINISHED,
  CANCELLED: non-terminal->CANCELLED). Idempotency is keyed on `twilioMessageSid`.
- Interaction status machine: PENDING->SENT|FAILED, SENT->DELIVERED|FAILED, DELIVERED->RESPONDED|FAILED.
