## Notifications

### Overview
Notifications are stored as:
- `notifications`: the notification intent (type/title/body/data) for a user
- `notification_deliveries`: per-channel delivery attempts (IN_APP/EMAIL/WHATSAPP)

In-app read/unread is represented by `notification_deliveries.readAt` for the `IN_APP` channel.

### Preferences
User preferences are stored in `notification_preferences`:
- `inAppEnabled`
- `externalEnabled`
- `preferredExternalChannel` (default: EMAIL)
- `overrides` (per notification type)

### Background dispatch (external channels)
External deliveries are processed by a cron job (every minute). Only EMAIL is implemented for now.

Environment variables:
- `NOTIFICATIONS_DISPATCH_ENABLED`: `true|false` (default false)
- `NOTIFICATIONS_DISPATCH_BATCH_SIZE`: how many pending deliveries to process per tick
- `NOTIFICATIONS_DISPATCH_MAX_ATTEMPTS`: max attempts before marking FAILED
- `NOTIFICATIONS_DISPATCH_RETRY_BASE_SECONDS`: exponential backoff base
- `NOTIFICATIONS_DISPATCH_RETRY_MAX_SECONDS`: backoff cap

Retry behavior:
- Failed attempts are rescheduled by setting `nextAttemptAt` (exponential backoff + jitter)
- After max attempts, the delivery is marked `FAILED`

### Retention
A daily job deletes notifications older than:
- `NOTIFICATIONS_RETENTION_DAYS` (default: 90)

