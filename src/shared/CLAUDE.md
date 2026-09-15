# Shared kernel (`src/shared`)

Only generic, context-agnostic code lives here. If something is specific to a bounded context,
it belongs in that context.

- `domain/events/`: `DomainEvent<TPayload>` interface and `EventBus` port (`EVENT_BUS` token).
- `domain/value-objects/`: `Email`, `Rating`, `UserRole` (legacy).
- `infrastructure/prisma/`: `PrismaModule` + `PrismaService` (the only place that instantiates
  `PrismaClient`). Import `PrismaModule` in contexts that have repositories.
- `infrastructure/events/`: `EventsModule` (`@Global`) providing `InMemoryEventBus`
  (`publish` + non-port `on` used by handlers). Swapping to an outbox/queue means implementing
  `EventBus` and keeping `on` semantics for handlers or migrating them.
- `infrastructure/messaging/`: `MessagingModule` with `TwilioClientService` (single Twilio client,
  used by WhatsApp adapter and Twilio Verify) and `MessageTemplateService` + `message-templates.json`
  (WhatsApp copy, Spanish es-AR, `{{var}}` placeholders).
- `presentation/decorators/`: `@CurrentUser()`, `@Public()`, `@Roles()`.
- `presentation/guards/`: `AdminGuard`, `ProfessionalGuard`, `RolesGuard`, and a duplicate
  `JwtAuthGuard` that controllers do NOT use (they import the Identity one). Do not add a third.

Rules: no bounded-context imports except `identity/domain/entities/user.entity` types in guards;
no business rules; adding a shared module requires importing it explicitly in consumer modules
(only `EventsModule` and `ConfigModule` are global).
