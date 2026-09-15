---
name: add-endpoint
description: Add or change a REST endpoint in specialist-be end-to-end following the project's DDD + AuthContext pattern (DTO, entity rule, service method, controller, response DTO, tests, docs). Use when asked to "add an endpoint", "expose X via API", "allow role Y to do Z".
---

# add-endpoint

Work top-down from the business rule, bottom-up in files. Check `docs/guides/PERMISSIONS_BY_ROLE.md`
and `docs/API_STRUCTURE.md` first to see whether the capability already exists.

## Steps

1. **Domain rule** (`src/<ctx>/domain/entities/<x>.entity.ts`)
   - If the action needs authorization, add/extend `XAuthContext` and add `canXxxBy(ctx)`.
     Admin bypass inside the rule. If state changes, add an immutable `withX()`/verb method that
     validates the transition and returns a new entity.
   - Add entity spec cases: allowed roles, denied roles, invalid transitions.
2. **Input DTO** (`src/<ctx>/application/dto/<verb>-<x>.dto.ts`): class-validator + `@ApiProperty`.
   Remember the global `forbidNonWhitelisted` pipe: undeclared fields cause 400.
3. **Service** (`src/<ctx>/application/services/<x>.service.ts`)
   - Method `xxxForUser(id, userId | user, dto)`: load via repository (`findById`, throw
     `NotFoundException`), `const ctx = await this.buildAuthContext(...)` (using
     `ProfileActivationService.getActivationStatus` when active-profile flags matter),
     `if (!entity.canXxxBy(ctx)) throw new ForbiddenException('...')`, mutate through entity method,
     `await repo.save(updated)`, publish domain event if other contexts care, return entity.
   - Cross-context data only via other contexts' services (`forwardRef` if cyclic).
   - Service spec: happy path, 404, 403, invalid state; mock repos/services as plain objects
     (see `.claude/rules/06-testing.md`).
4. **Repository** only if a new query is needed: add to the interface in `domain/repositories`
   (entity results) or `domain/queries` (read models), implement in `infrastructure/`, update the
   mock objects in existing specs that enumerate repository methods.
5. **Controller** (`src/<ctx>/presentation/<x>.controller.ts`)
   - `@Post(':id/<verb>')` etc. with `@ApiOperation`, `@ApiResponse`; static routes before `:id`.
   - Body: `@CurrentUser() user: UserEntity`, `@Body() dto`, delegate, wrap with
     `XResponseDto.fromEntity(...)`. No permission logic, no try/catch.
   - Public routes get `@Public()`; admin routes `@UseGuards(AdminGuard)`.
6. **Response DTO** (`presentation/dto/`): extend `fromEntity` / add a limited variant if some
   roles must not see contact data.
7. **Verify**: run the `arch-check` skill. Optionally curl against `npm run start:dev` using seed
   users (`docs/guides/POSTMAN_GUIDE.md`, `VERIFICATION_TEST_COMMANDS.md` for token flow).
8. **Docs**: `docs/API.md`, `docs/API_STRUCTURE.md`, `docs/guides/PERMISSIONS_BY_ROLE.md`, and a
   line in `TODO.md` if it closes a backlog item. Mention frontend/admin repo follow-ups
   (`/var/www/specialist/specialist-fe`, `specialist-admin`) in the final summary; do not edit them
   unless asked.
