# Notifications context (`src/notifications`)

Materializes in-app notifications and external deliveries (email now, WhatsApp channel modeled)
from domain events of other contexts. Docs: `docs/guides/NOTIFICATIONS.md`,
`docs/decisions/ADR-003-NOTIFICATIONS-DELIVERY-RETRY-RETENTION.md`.

## Public API (exported by `NotificationsModule`)

- `NotificationService`: `createForUser({ userId, type, title, body?, data?, idempotencyKey?, includeExternal?, requireExternal?, forceExternalChannel? })`,
  `listForUser`, `markRead(user, id)`, `markAllRead`, `findByIdForUser`, `listAll` (admin),
  `getDeliveryStats`, `resendNotification` (admin).
- `NotificationPreferencesService`: `getForUser`, `upsertForUser`.
- Internal: `InAppNotificationService` (legacy in-app table), `NotificationDispatchService`.

## Endpoints

`/notifications` GET, `/:id/read` PATCH, `/read-all` PATCH, `/preferences` GET/PUT.
`/admin/notifications` GET, `/stats` GET, `/email-status` GET, `/:id` GET, `/:id/resend` POST
(AdminGuard). `/email-status` must stay declared before `/:id` (Nest route order).

## Model

- `Notification` (intent: type, title, body, data, idempotencyKey) + `NotificationDelivery` per
  channel (`IN_APP|EMAIL|WHATSAPP`) with `status` (`PENDING|SENT|FAILED|SKIPPED`), `attemptCount`,
  `lastAttemptAt`, `nextAttemptAt`, `readAt`. In-app "read" = IN_APP delivery `readAt`.
- `NotificationEntity`: `isRead()`, `getDeliveryByChannel`, `hasFailedDelivery`,
  `hasPendingExternalDelivery`, `NotificationAuthContext` + `canBeViewedBy`, `canBeMarkedReadBy`,
  `canBeResentBy` (admin).
- `NotificationPreferencesEntity.effectiveFor(type)` -> `{ inAppEnabled, externalEnabled, preferredExternalChannel }`
  with per-type overrides.
- Ports: `EMAIL_SENDER` (`SmtpEmailSender` default, `MailgunEmailSender` when
  `EMAIL_PROVIDER=mailgun`, `EtherealEmailSender` when `EMAIL_PROVIDER=ethereal` - dynamically
  provisions a throwaway ethereal.email test account, no config needed, pre-launch Fly deploy
  only - chosen in `email-sender.factory.ts`), `NOTIFICATION_DELIVERY_QUEUE`
  (`PrismaNotificationDeliveryQueue`: claim pending, mark sent/failed with backoff). `send()`
  returns the provider's message id (or a preview URL for Ethereal/Mailgun), persisted as the
  delivery's `providerMessageId` and exposed to admins via `NotificationResponseDto.fromEntityForAdmin`
  (`GET /admin/notifications`) - never exposed on the user-facing `/notifications` endpoints.
  `EmailSender.describe(): Promise<EmailProviderStatus>` (all three adapters implement it) reports
  the active provider and, for Ethereal, its live login credentials (lazily provisioning the
  account if `send()` hasn't run yet); backs `GET /admin/notifications/email-status` via
  `NotificationDispatchService.getEmailStatus()` (same-module injection into
  `AdminNotificationsController`, no `NotificationsModule.exports` change needed).

## Handlers (subscribe in `onModuleInit`)

- `RequestsNotificationsHandler`: `request_interest.expressed` -> client; `professional_assigned`
  -> provider user (`providerUserId`); `status_changed` -> counterpart. `request.created` is
  subscribed but intentionally silent.
- `ReviewsNotificationsHandler`: `review.approved` -> provider user.
- `RequestAttentionFlaggedHandler`: `requests.request_attention.flagged` -> every admin
  (`UserService.findAdminUserIds()`), in-app only (`includeExternal: false`).
- `UserWhatsAppOptedOutHandler`: `identity.user.whatsapp_opted_out` -> the opted-out user
  (`REQUIRES_EXTERNAL: true`, `forceExternalChannel: NotificationChannel.EMAIL` — never WhatsApp,
  since that's unavailable to this user by definition; see "Forcing the external channel" in
  `docs/guides/NOTIFICATIONS.md`). Event comes from the Identity context
  (`src/identity/domain/events/user-whatsapp-opted-out.event.ts`), published only on the
  `false -> true` transition, whether triggered by the WhatsApp reply classifier or the admin
  override (`PUT /admin/users/:id/whatsapp-opt-out`).
Types in use: `REQUEST_STATUS_CHANGED`, `REQUEST_INTEREST_EXPRESSED`, `REQUEST_PROFESSIONAL_ASSIGNED`,
`REVIEW_APPROVED`, `REQUEST_ATTENTION_FLAGGED`, `WHATSAPP_OPTED_OUT`. Copy is Spanish (es-AR).

## Jobs

`NotificationDispatchJob` (`*/1 * * * *`, `NOTIFICATIONS_DISPATCH_ENABLED`, batch
`NOTIFICATIONS_DISPATCH_BATCH_SIZE`, retries `NOTIFICATIONS_DISPATCH_MAX_ATTEMPTS` with
exponential backoff `*_RETRY_BASE_SECONDS`/`*_RETRY_MAX_SECONDS`), `NotificationRetentionJob`
(`15 3 * * *`, `NOTIFICATIONS_RETENTION_DAYS`, default 90). Local email goes to Mailpit
(`docker-compose.dev.yml`, UI :8025).

## Gotchas

- Never add a `read` flag to `Notification`; use the IN_APP delivery.
- Use `idempotencyKey` for event-driven notifications so re-delivered events don't duplicate.
- Dispatcher has no distributed lock; single instance assumed.
- Handlers resolve the recipient from event payload ids (`providerUserId`), not by re-querying
  repositories of other contexts.

## Tests

`notification.service.spec.ts`, `request-attention-flagged.handler.spec.ts`,
`user-whatsapp-opted-out.handler.spec.ts`.
