---
paths:
  - "src/**/presentation/**"
  - "src/**/application/dto/**"
  - "src/main.ts"
---

# Presentation layer and API conventions

Source of truth: `docs/API_STRUCTURE.md`, `docs/API.md`. Global prefix `api`; Swagger at
`/api/docs` (disabled in production). Global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`:
any body field not declared in the DTO makes the request fail with 400, so every accepted field
must be declared with class-validator decorators.

## Controllers

- `@ApiTags('X')`, `@ApiBearerAuth()`, `@Controller('x')`, `@UseGuards(JwtAuthGuard)` at class level;
  `@Public()` per route for anonymous access; `@UseGuards(AdminGuard)` for admin routes.
- `@ApiOperation({ summary })` and `@ApiResponse({ status, type })` on every handler.
- Route order matters in Nest: declare static segments (`available`, `interested`, `me`,
  `read-all`, `preferences`) BEFORE `:id` routes.
- Return response DTOs built with static factories (`RequestResponseDto.fromEntity(entity)`,
  `fromEntityLimited` for restricted views). Never return domain entities or Prisma records.
- Do not expose other users' phone/email/whatsapp/full address in public listings. Contact data is
  only returned to participants of an assigned request or to the owner/admin.
- Use `@HttpCode(HttpStatus.NO_CONTENT)` for deletes/removals that return nothing.
- Pagination: `?page=&limit=` query params, response `{ data, meta: { total, page, limit, totalPages } }`.
- Controllers may call several services to compose a view (e.g. resolve provider context) but must
  not decide permissions or mutate state directly.

## Input DTOs (`application/dto/`)

- `class-validator` + `@ApiProperty({ example, description, required })` on every field.
- Conditional requirements via `@ValidateIf` (see `CreateRequestDto`: `professionalId | companyId`
  for direct requests, `tradeId` for public ones).
- Ratings are `1..5` integers; phone numbers E.164 (`+54...`).
- DTOs are transport contracts; never put business rules in them beyond shape validation.

## Errors

NestJS built-in exceptions only; messages in English for developers unless the message is shown
to end users by the frontend (then Spanish, es-AR). Do not wrap exceptions in controllers.

## When an endpoint changes

Update `docs/API.md` and `docs/API_STRUCTURE.md` (and `docs/guides/PERMISSIONS_BY_ROLE.md` if the
role matrix changes). The Postman collection at repo root is legacy and not maintained.
