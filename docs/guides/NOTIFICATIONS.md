# Notifications

## Overview

The notification system supports multiple delivery channels:
- **IN_APP**: Stored notifications visible in the app
- **EMAIL**: Sent via SMTP or Mailgun API
- **WHATSAPP**: (Planned)

Notifications are stored as:
- `notifications`: The notification intent (type/title/body/data) for a user
- `notification_deliveries`: Per-channel delivery attempts (IN_APP/EMAIL/WHATSAPP)

In-app read/unread is represented by `notification_deliveries.readAt` for the `IN_APP` channel.

---

## API Endpoints

### List Notifications
```http
GET /api/notifications?take=20&unreadOnly=true
Authorization: Bearer <token>
```

### Mark as Read
```http
PATCH /api/notifications/:id/read
Authorization: Bearer <token>
```

### Mark All as Read
```http
PATCH /api/notifications/read-all
Authorization: Bearer <token>
```

### Get Preferences
```http
GET /api/notifications/preferences
Authorization: Bearer <token>
```

### Update Preferences
```http
PUT /api/notifications/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "inAppEnabled": true,
  "externalEnabled": true,
  "preferredExternalChannel": "EMAIL"
}
```

---

## Preferences

User preferences are stored in `notification_preferences`:
- `inAppEnabled`: Enable/disable in-app notifications
- `externalEnabled`: Enable/disable email/whatsapp notifications
- `preferredExternalChannel`: `EMAIL` (default) or `WHATSAPP`
- `overrides`: Per notification type overrides

---

## Email Providers

The system supports two email providers, configured via `EMAIL_PROVIDER` environment variable.

### SMTP (Default)

Used for local development with Mailpit or production SMTP servers.

```env
EMAIL_PROVIDER=smtp
NOTIFICATIONS_SMTP_HOST=localhost
NOTIFICATIONS_SMTP_PORT=1025
NOTIFICATIONS_SMTP_USER=
NOTIFICATIONS_SMTP_PASS=
NOTIFICATIONS_SMTP_FROM=noreply@specialist.local
```

For Gmail SMTP:
```env
EMAIL_PROVIDER=smtp
NOTIFICATIONS_SMTP_HOST=smtp.gmail.com
NOTIFICATIONS_SMTP_PORT=587
NOTIFICATIONS_SMTP_USER=your-email@gmail.com
NOTIFICATIONS_SMTP_PASS=your-app-password  # NOT your Gmail password!
NOTIFICATIONS_SMTP_FROM=your-email@gmail.com
```

> ⚠️ Gmail requires an [App Password](https://support.google.com/accounts/answer/185833) with 2-Step Verification enabled.

### Mailgun API

For production use with Mailgun:

```env
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM=Specialist <noreply@yourdomain.com>
```

---

## Local Development with Mailpit

Docker Compose includes Mailpit for local email testing:

```yaml
mailpit:
  image: axllent/mailpit:latest
  ports:
    - "8025:8025"  # Web UI
    - "1025:1025"  # SMTP
```

Access the web UI at: http://localhost:8025

---

## Background Dispatch (External Channels)

External deliveries (EMAIL/WHATSAPP) are processed by a cron job running every minute.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NOTIFICATIONS_DISPATCH_ENABLED` | Enable background dispatch | `false` |
| `NOTIFICATIONS_DISPATCH_BATCH_SIZE` | Deliveries per tick | `50` |
| `NOTIFICATIONS_DISPATCH_MAX_ATTEMPTS` | Max attempts before FAILED | `5` |
| `NOTIFICATIONS_DISPATCH_RETRY_BASE_SECONDS` | Exponential backoff base | `60` |
| `NOTIFICATIONS_DISPATCH_RETRY_MAX_SECONDS` | Backoff cap | `3600` |

### Retry Behavior

- Failed attempts are rescheduled with exponential backoff + jitter
- After max attempts, the delivery is marked `FAILED`
- `nextAttemptAt` determines when retry is allowed

---

## Retention

A daily job deletes notifications older than:
- `NOTIFICATIONS_RETENTION_DAYS` (default: 90)

---

## Notification Types

| Type | Trigger | Recipients |
|------|---------|------------|
| `REQUEST_STATUS_CHANGED` | Request status update | Client & Professional |
| `REQUEST_INTEREST_EXPRESSED` | Professional shows interest | Client |
| `REQUEST_PROFESSIONAL_ASSIGNED` | Professional assigned | Professional |
| `REVIEW_APPROVED` | Admin approves review | Professional |

---

## Event-Driven Architecture

Notifications are created via domain events:

```typescript
// When a review is approved
await this.eventBus.publish(new ReviewApprovedEvent({
  reviewId: review.id,
  professionalId: review.professionalId,
  // ...
}));

// Handler creates the notification
@OnEvent(ReviewApprovedEvent.EVENT_NAME)
async handleReviewApproved(event: ReviewApprovedEvent) {
  await this.notifications.createForUser({
    userId: professionalUserId,
    type: 'REVIEW_APPROVED',
    title: '¡Tenés una nueva reseña!',
    includeExternal: true,
  });
}
```
