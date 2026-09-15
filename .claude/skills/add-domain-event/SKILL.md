---
name: add-domain-event
description: Add a domain event in specialist-be and wire its consumers (event class, publish after save, handler subscription, notification creation, tests). Use when a change in one context must trigger side effects in another (notifications, status changes, stats).
---

# add-domain-event

1. **Event class** `src/<ctx>/domain/events/<aggregate>-<verb>.event.ts`:
   ```ts
   export interface XVerbPayload { xId: string; /* ids + display names only */ }
   export class XVerbEvent implements DomainEvent<XVerbPayload> {
     public static readonly EVENT_NAME = '<ctx>.<aggregate>.<verb_past_tense>';
     readonly name = XVerbEvent.EVENT_NAME;
     readonly occurredAt = new Date();
     constructor(public readonly payload: XVerbPayload) {}
   }
   ```
   Provider-related payloads include `serviceProviderId`, `providerUserId`, `providerType`,
   `providerName`. Never put entities or Prisma records in payloads.
2. **Publish** in the application service right after `repository.save(...)` succeeds:
   `await this.eventBus.publish(new XVerbEvent({...}))` (`@Inject(EVENT_BUS) eventBus: EventBus`).
   Add a spec assertion: `expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: XVerbEvent.EVENT_NAME }))`.
3. **Handler** in the consuming context `src/<other>/application/handlers/<topic>.handler.ts`
   (`@Injectable`, `implements OnModuleInit`, subscribe with `this.eventBus.on(XVerbEvent.EVENT_NAME, ...)`,
   guard for `on` not being a function, try/catch + `Logger` inside each handler). Register it in
   that module's `providers`. Import only the event class from the emitting context.
4. **Notification** (if applicable): `NotificationService.createForUser({ userId, type: 'X_VERB', title, body, data, idempotencyKey })`
   with Spanish (es-AR) copy; add the type to `docs/guides/NOTIFICATIONS.md`.
5. **Request status changes from events** (WhatsApp replies) live in
   `src/requests/application/handlers/request-interaction-responded.handler.ts`; extend the
   intent->transition map there instead of calling `RequestService` from the interaction service.
6. Update `docs/guides/NOTIFICATIONS.md` (events table) and run the `arch-check` skill.

Remember the bus is in-memory and fire-and-forget: handlers must be idempotent and tolerate
being skipped after a crash.
