# Notifications context (`src/notifications`)

Materializes in-app notifications and external deliveries (email now, WhatsApp channel modeled)
from domain events of other contexts. Docs: `docs/guides/NOTIFICATIONS.md`,
`docs/decisions/ADR-003-NOTIFICATIONS-DELIVERY-RETRY-RETENTION.md`.

## Public API (exported by `NotificationsModule`)

- `NotificationService`: `createForUser({ userId, type, title, body?, data?, idempotencyKey?, includeExternal?, requireExternal? })`,
  `listForUser`, `markRead(user, id)`, `markAllRead`, `findByIdForUser`, `listAll` (admin),
  `getDeliveryStats`, `resendNotification` (admin).
- `NotificationPreferencesService`: `getForUser`, `upsertForUser`.
- Internal: `InAppNotificationService` (legacy in-app table), `NotificationDispatchService`.

## Endpoints

`/notifications` GET, `/:id/read` PATCH, `/read-all` PATCH, `/preferences` GET/PUT.
`/admin/notifications` GET, `/stats` GET, `/:id` GET, `/:id/resend` POST (AdminGuard).

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
  `EMAIL_PROVIDER=mailgun`, chosen in `email-sender.factory.ts`), `NOTIFICATION_DELIVERY_QUEUE`
  (`PrismaNotificationDeliveryQueue`: claim pending, mark sent/failed with backoff).

## Handlers (subscribe in `onModuleInit`)

- `RequestsNotificationsHandler`: `request_interest.expressed` -> client; `professional_assigned`
  -> provider user (`providerUserId`); `status_changed` -> counterpart. `request.created` is
  subscribed but intentionally silent.
- `ReviewsNotificationsHandler`: `review.approved` -> provider user.
Types in use: `REQUEST_STATUS_CHANGED`, `REQUEST_INTEREST_EXPRESSED`, `REQUEST_PROFESSIONAL_ASSIGNED`,
`REVIEW_APPROVED`. Copy is Spanish (es-AR).

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

`notification.service.spec.ts`.
