---
name: add-entity-field
description: Add, rename or remove a persisted field on an aggregate in specialist-be, touching every layer in order (Prisma schema + migration, entity, mapper, repository, DTOs, response DTOs, test factories, seed, docs). Use when asked to "add a column/field/attribute" to User, Request, Professional, Company, Review, Notification, etc.
---

# add-entity-field

Layers to touch, in order. Skipping one usually shows up as a runtime `undefined` because
`strictNullChecks` is off.

1. `prisma/schema.prisma`: add the field (nullable or with `@default` if the table has rows).
   `npx prisma migrate dev --name add_<field>_to_<model>` then `npx prisma generate`. Review the SQL;
   for renames write `ALTER TABLE ... RENAME COLUMN` manually instead of drop+add.
2. `src/<ctx>/domain/entities/<x>.entity.ts`: constructor param (`public readonly field: T | null`),
   static factory defaults, `withX()` copies, any predicate that depends on it. Entities are
   positional constructors: add the param at the end or update every `new XEntity(` call site
   (`grep -rn "new XEntity(" src`).
3. `src/<ctx>/infrastructure/mappers/<x>.prisma-mapper.ts`: `toDomain` and `toPersistence`.
4. Repository `include/select` constants if the field comes from a relation.
5. Input DTOs (`application/dto/create-*.dto.ts`, `update-*.dto.ts`) with validators + `@ApiProperty`.
6. Response DTOs (`presentation/dto/*-response.dto.ts`) `fromEntity` (and limited variants: decide
   whether the field is sensitive).
7. `src/__mocks__/test-utils.ts` factory defaults; fix specs that construct entities positionally.
8. `prisma/seed.ts` sample values.
9. Docs: `docs/guides/MIGRATION_GUIDE.md` entry if destructive; `docs/API.md` if exposed;
   `docs/architecture/DOMAIN_MODEL.md` only if you are already updating it (it is stale).
10. Run the `arch-check` skill.

Rules to respect: contact data (phone/email/whatsapp) belongs to `User` only; no `active` booleans
on profiles (derive from `status`); rating/totalReviews belong to `ServiceProvider`; new references
to a provider use `serviceProviderId`, not `professionalId`.
