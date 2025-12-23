## ADR-003: Notification delivery retries & retention

### Status
Accepted

### Context
We need a Notifications bounded context that:
- Persists notifications and per-channel delivery attempts (in-app/email/whatsapp).
- Can deliver external notifications asynchronously (background processing).
- Avoids unbounded growth of notification records.

We currently use Postgres + Prisma and an in-process event bus.

### Decision
- **Persistence**: Store notifications in Postgres as:
  - `notifications` (intent) and
  - `notification_deliveries` (one row per channel).
- **Retry strategy**: For external deliveries, retries are handled via:
  - `attemptCount`, `lastAttemptAt`, `nextAttemptAt` on `notification_deliveries`
  - Exponential backoff with jitter (configurable)
  - Transition to `FAILED` when max attempts is reached.
- **Retention**: Notifications older than `NOTIFICATIONS_RETENTION_DAYS` (default 90) are deleted daily.

### Consequences
- **Pros**
  - Delivery is auditable: you can inspect status per channel and failures.
  - Retry logic is centralized and configurable.
  - Retention keeps DB growth under control.
  - Persistence can be swapped later by implementing repository/queue ports.
- **Cons / tradeoffs**
  - Current dispatcher is a simple poller; without a distributed lock, multiple app instances may race.
    - In the future we may add row locking / leasing (e.g., `lockedAt`, `lockedBy`) or move to an outbox/queue worker.
  - Until external senders are fully implemented, deliveries can remain `PENDING`.

### Follow-ups (future)
- Add WhatsApp sender + dispatcher.
- Add idempotency at provider level where supported (provider message keys).
- Add leasing/locking for multi-instance deployments.

