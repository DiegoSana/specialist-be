# 🔧 Tareas Pendientes - Specialist Backend

> Última actualización: 2026-09-15

> **Nueva sección:** [Perfil activo (MVP): reglas y restricciones](#-perfil-activo-mvp-reglas-y-restricciones) — definición de activo (email + teléfono usuario + confirmación admin), restricciones por perfil activo, y orden de implementación.

---

## ✅ Cierre – Lo realizado hasta ahora (resumen ejecutivo)

**Perfil activo y permisos (backend):**
- **ProfileActivationService:** único punto que define “perfil activo” (cliente y proveedor). RequestService y RequestInterestService usan solo este servicio; no se llama `user.isFullyVerified()` repartido.
- **Crear solicitud:** exige cliente activo. **Expresar interés:** exige proveedor activo. **Asignar proveedor:** exige cliente activo (`canAssignProviderBy` + `hasActiveClientProfile`). **Job board (ver lista):** no exige activo; solo expresar interés lo exige.
- **GET /providers (catálogo):** solo muestra perfiles activos (usuario verificado + perfil canOperate). Filtro `userVerified` en repos de Professional y Company; `onlyActiveInCatalog: true` en ProvidersController.
- **RequestsController:** soporte Company en findMyRequests y findAvailable; vista limitada en `findByIdForInterestedProvider` + `fromEntityLimited`; RateClientDto con validación; TODOs de excepciones eliminados.
- **Admin:** `PUT /admin/users/:id/verification` para marcar email/teléfono verificados (override manual).

**Contacto unificado (si ya aplicaste la migración):** contacto solo en User; perfiles sin phone/email/whatsapp; canOperate = solo status ACTIVE/VERIFIED.

**Tests:** 291 pasando (suite completa verificada antes de rama/commits).

**Pendiente para otra sesión:** tests opcionales (ProfileActivationService, “assign rechazado si no activo”); Frontend B.3 mensajes; Admin Fase D moderación reviews; mejora “notificar a clientes cuando proveedor cambia teléfono/email”.

---

## 📌 Donde quedamos hoy (recap para seguir mañana)

### ✅ Hecho (2026-09-15): Harness de Claude Code + docs al día

- **Harness**: `CLAUDE.md` raíz, `src/<contexto>/CLAUDE.md`, `.claude/rules/01..08`, `.claude/skills/*`, `.claude/settings.json`.
- **Docs refrescados contra el código**: `DOMAIN_MODEL.md`, `ROLES_ARCHITECTURE.md`, `COMPANY_PROFILES.md`, `REVIEW_MODERATION.md`, `ADR-004` (`reviewCount` → `totalReviews`), `docs/README.md` (índice completo), `whatsapp/README.md` (regla PENDING 3 días), ports/defaults en `DOCKER.md`, `ENVIRONMENT_VARIABLES.md`, `NOTIFICATIONS.md`; `whatsapp-followup-implementation-status.md` marcado histórico; `admin-portal-plan.md` usa `specialist-be`.
- **Fix**: `identity.module.ts` lee `JWT_EXPIRES_IN` (antes `JWT_EXPIRATION`, que `.env`/compose/docs no definían); `JWT_EXPIRATION` queda como fallback.

### 🟡 Estados del pedido (2026-09-21, PR1 de 5 — rama `feat/estados-pedido-pr1`)
Spec: `docs/EspecialistBRC — Estados del pedido.md`. PR1 = enum de 15 estados + tabla de transiciones por actor; el resto (sub-estados de interés, vencimientos, WhatsApp, soporte) va en PR2-PR5. Supuestos por defecto para las decisiones "Abiertas" del spec (revisar con datos reales):
- [ ] Pedido público que no se concreta con el elegido: el cliente publica de nuevo (no vuelve a la bolsa); `unassignProvider` queda como herramienta correctiva, no flujo cliente-facing.
- [ ] Abandonado: solo aplica a `CONTACT_RELEASED` tras agotar recordatorios; `IN_PROGRESS -> ABANDONED` sin mapear.
- [ ] Cierre automático (`FINISHED -> CLOSED` por vencimiento) califica con el mismo peso que un cierre confirmado.
- [x] PR3 (`feat/estados-pedido-pr3`): `RequestExpirationJob` (Sistema) aplica PUBLISHED->EXPIRED (6d), SENT->NO_RESPONSE (6d), CONTACT_RELEASED->ABANDONED (8d, supuesto: margen tras el último recordatorio de 6d), FINISHED->CLOSED (7d); plazos por env `REQUEST_EXPIRY_DAYS_*`, job apagado por defecto (`REQUEST_EXPIRATION_ENABLED`).
- [ ] TODO abierto: `IN_PROGRESS -> ABANDONED` NO implementado (pregunta abierta del spec); En curso solo deja de recibir recordatorios.

### ⬜ Hallazgos pendientes (2026-09-15)

- [ ] `ReviewService.updateServiceProviderRating` no recalcula rating para Company (TODO en código; `CompanyService.updateRating` sin usar).
- [ ] `CreateReviewDto`: `professionalId` requerido pero ignorado; `requestId` opcional en DTO pero requerido en el service. Alinear DTO con el service.
- [x] Lint: repo formateado completo con `npm run lint` (2026-09-15); 0 errores eslint, prettier limpio. Mantenerlo así (correr `npm run lint` antes de cada commit).
- [ ] `@specialist/shared`: tipos desactualizados (`User.role`, `UserStatus`, `AdminContract` con PATCH vs PUT); solo lo usa el login de `specialist-admin`. Decidir si se genera desde el backend o se retira.
- [ ] `GET /professionals/:id/reviews` no tiene equivalente para companies.


### ✅ Hecho (2026-02-06): Contacto unificado y solo status en perfiles

- Contacto en User: Company sin phone/email; Professional sin whatsapp. Migración `20260206000000_remove_profile_contact_and_active`.
- Solo status en perfiles: sin `active`; canOperate = status ACTIVE/VERIFIED. Docs y scripts en MIGRATION_GUIDE.

### ✅ Hecho anteriormente

1. **Servicio de orquestación “perfil activo”**
   - **ProfileActivationService** (`src/profiles/application/services/profile-activation.service.ts`): único punto que define `hasActiveClientProfile` y `hasActiveProviderProfile` (componiendo User + Professional/Company + `isFullyVerified` / `canOperate`).
   - Ningún otro servicio llama a `user.isFullyVerified()` para permisos; todos usan este servicio.

2. **RequestAuthContext**
   - Añadido `hasActiveClientProfile`; ya existía `hasActiveProviderProfile`. Ambos se rellenan desde la orquestación.
   - Ver `src/requests/domain/entities/request.entity.ts`.

3. **RequestService**
   - **create():** usa `profileActivationService.getActivationStatus(clientId).hasActiveClientProfile` en lugar de `user.isFullyVerified()`.
   - **buildAuthContext():** llama a `getActivationStatus(userId)` y devuelve `hasActiveClientProfile`, `hasActiveProviderProfile` y `serviceProviderId`.

4. **RequestInterestService**
   - **buildAuthContext():** usa `profileActivationService.getActivationStatus(userId)` para `hasActiveProviderProfile`; se quitó la composición inline y la dependencia de UserService.

5. **Documentación**
   - **PROFILE_ACTIVATION_ORCHESTRATION.md** (`docs/architecture/`): diseño del servicio, uso en AuthContexts, auditoría de endpoints, orden de implementación.
   - **PERMISSIONS_BY_ROLE.md** y **AUTHORIZATION_PATTERN.md**: referencias al servicio de orquestación.

6. **Tests**
   - Request y RequestInterest specs actualizados (mock de ProfileActivationService). **291 tests pasando.**

### ✅ Hecho además (controller y restricciones)

- **RequestsController:** Company en findMyRequests/findAvailable; vista limitada → `findByIdForInterestedProvider` + `fromEntityLimited`; TODOs de excepciones eliminados; **RateClientDto** (rating 1–5, comment opcional).
- **Restricciones:** `canAssignProviderBy` exige `hasActiveClientProfile`; expresar interés exige `hasActiveProviderProfile`. Ver lista de requests disponibles (job board) no exige perfil activo; sí lo exige el listado de proveedores (GET /providers) para aparecer en catálogo.

### ⬜ Siguiente (cuando retomes)
- **Fase A:** GET /providers ya filtra por usuario verificado + perfil activo. A.4 hecho: contacto solo en User (sin phone/email en Company, sin whatsapp en Professional).
- **Tests:** opcional spec para `ProfileActivationService`; opcional test "assign rechazado si cliente no activo".
- **Frontend / Admin:** B.3 mensajes al rechazar por perfil no activo; Fase D pantalla moderación de reviews.

### Archivos clave para seguir

| Qué | Dónde |
|-----|--------|
| Orquestación | `src/profiles/application/services/profile-activation.service.ts` |
| Diseño y auditoría | `docs/architecture/PROFILE_ACTIVATION_ORCHESTRATION.md` |
| Contexto Request | `src/requests/domain/entities/request.entity.ts` (RequestAuthContext) |
| Uso en create/buildAuthContext | `request.service.ts`, `request-interest.service.ts` |

---

## 📋 Resumen de Estado

| Módulo | Permisos | Tests | Documentado |
|--------|----------|-------|-------------|
| Requests | ✅ | ✅ | ⬜ |
| Request Interest | ✅ | ✅ | ⬜ |
| Reviews | ✅ | ✅ | ⬜ |
| Notifications | ✅ | ✅ | ✅ |
| Profiles | ✅ | ✅ | ⬜ |
| Identity | ✅ | ✅ | ⬜ |
| **Companies** | ✅ | ✅ | ✅ |
| **RequestInterest** | ✅ | ✅ | ✅ |

---

## 🔐 Refactoring de Permisos

### ✅ Completado

- [x] **Requests Module**
  - [x] Crear `RequestAuthContext` interface en dominio
  - [x] Agregar métodos de autorización a `RequestEntity`:
    - `canBeViewedBy(ctx)`
    - `canManagePhotosBy(ctx)`
    - `canChangeStatusBy(ctx, newStatus)`
    - `canRateClientBy(ctx)`
    - `canExpressInterestBy(ctx)`
    - `canAssignProfessionalBy(ctx)`
  - [x] Refactorizar `RequestService` para usar métodos de dominio
  - [x] Refactorizar `RequestInterestService` para usar métodos de dominio
  - [x] Agregar `buildAuthContext()` helper en servicios
  - [x] Simplificar `RequestsController` (solo construye contexto y delega)
  - [x] Soporte para Admin en todos los permisos
  - [x] Actualizar tests

### ✅ Completado

- [x] **Requests Module** (completado anteriormente)

- [x] **Reviews Module**
  - [x] Crear `ReviewAuthContext` interface en dominio
  - [x] Agregar métodos de autorización a `ReviewEntity`:
    - `canBeViewedBy(ctx)` - APPROVED: público, PENDING/REJECTED: solo reviewer + admin
    - `canBeModifiedBy(ctx)` - solo reviewer y solo si PENDING
    - `canBeModeratedBy(ctx)` - solo admins y solo si PENDING
  - [x] Agregar `buildAuthContext()` helper a entidad
  - [x] Refactorizar `ReviewService`:
    - `findByIdForUser()` - con validación de permisos
    - `findByRequestIdForUser()` - con validación de permisos
    - `update()` / `delete()` - valida canBeModifiedBy
    - `approve()` / `reject()` - valida canBeModeratedBy
  - [x] Actualizar `ReviewsController`
  - [x] Actualizar tests (37 tests pasando)

### ✅ Completado

- [x] **Notifications Module**
  - [x] Crear `NotificationAuthContext` interface en dominio
  - [x] Agregar métodos de autorización a `NotificationEntity`:
    - `canBeViewedBy(ctx)` - owner o admin
    - `canBeMarkedReadBy(ctx)` - solo owner
    - `canBeResentBy(ctx)` - solo admin con delivery fallido
  - [x] Refactorizar `NotificationService.markRead()` para usar métodos de dominio
  - [x] Agregar métodos admin: `findByIdForUser()`, `listAll()`, `getDeliveryStats()`, `resendNotification()`
  - [x] Crear `AdminNotificationsController`:
    - `GET /admin/notifications` - listar todas con filtros
    - `GET /admin/notifications/stats` - estadísticas de delivery
    - `GET /admin/notifications/:id` - ver detalle
    - `POST /admin/notifications/:id/resend` - reenviar fallidas
  - [x] Actualizar tests

- [x] **Profiles Module**
  - [x] Crear `ProfessionalAuthContext` interface en dominio
  - [x] Agregar métodos de autorización a `ProfessionalEntity`:
    - `isOwnedBy(userId)` - helper para verificar propiedad
    - `canViewFullProfileBy(ctx)` - owner o admin
    - `canBeEditedBy(ctx)` - owner o admin
    - `canManageGalleryBy(ctx)` - owner o admin
    - `canChangeStatusBy(ctx)` - solo admin
  - [x] Refactorizar `ProfessionalService`:
    - `updateProfile()` - usa `canBeEditedBy()`
    - `addGalleryItem()` / `removeGalleryItem()` - usa `canManageGalleryBy()`
    - `updateStatus()` - usa `canChangeStatusBy()` y requiere user
  - [x] Actualizar `AdminService.updateProfessionalStatus()` para pasar user
  - [x] Actualizar tests (222 tests pasando)
  - [x] `ClientService` no requiere refactor (solo activa perfil propio)

- [x] **Identity Module**
  - [x] Crear `UserAuthContext` interface en dominio
  - [x] Agregar métodos de autorización a `UserEntity`:
    - `isSelf(ctx)` - helper para verificar si es el mismo usuario
    - `canBeViewedBy(ctx)` - self o admin
    - `canBeEditedBy(ctx)` - self o admin
    - `canChangeStatusBy(ctx)` - solo admin
    - `canBeDeletedBy(ctx)` - self o admin
  - [x] Agregar `buildAuthContext()` static helper
  - [x] Agregar métodos permission-aware a `UserService`:
    - `findByIdForUser()` - con validación de permisos
    - `updateForUser()` - con validación de permisos
    - `updateStatusForUser()` - solo admin
  - [x] Actualizar `AdminService`:
    - `getUserById()` usa `findByIdForUser()`
    - `updateUserStatus()` usa `updateStatusForUser()`
  - [x] Actualizar `AdminController` para pasar `@CurrentUser()`
  - [x] Actualizar tests (222 tests pasando)

### ⬜ Pendiente

---

## 🐛 Bug Fixes

### ✅ Completados

- [x] **FE: Solicitudes no aparecían en "mis solicitudes" del especialista**
  - Causa: `useProfessionalRequests` no pasaba `role=professional`
  - Fix: Agregar `?role=professional` al endpoint

- [x] **FE: Botón "Aceptar Presupuesto" visible (no es MVP)**
  - Fix: Removido de `client/requests/[id]/page.tsx`

- [x] **BE: Cualquier usuario podía ver cualquier solicitud por URL**
  - Fix: Agregar `canBeViewedBy()` y validar en `findByIdForUser()`

### ⬜ Pendiente

- [ ] **Verificar acceso a solicitudes desde perfil de otros especialistas**
  - Revisar cómo se muestran las solicitudes completadas en perfiles públicos

- [ ] **Revisar validación de permisos en fotos de solicitudes**
  - ¿Las fotos de trabajo completado son públicas?
  - ¿Quién puede ver las fotos durante el trabajo en progreso?

---

## 🗑️ Código a Eliminar (No MVP)

### ✅ Eliminado

- [x] `POST /requests/:id/accept` endpoint
- [x] `acceptQuote()` método en `RequestService`
- [x] `updateStatusByClient()` (unificado en `updateStatus()`)
- [x] `useAcceptQuote` hook en frontend (import removido)

### ⬜ Pendiente Evaluar

- [ ] Campos `quoteAmount` y `quoteNotes` en Request
  - ¿Mantener en schema para futuro MVP+?
  - ¿Eliminar completamente?

---

## 📝 Pull Requests

### ✅ Mergeados

| PR | Repo | Descripción |
|----|------|-------------|
| #10 | BE | feat: Request title + notificaciones mejoradas |
| #11 | BE | refactor: Permission validation hybrid pattern |
| #3 | FE | fix: Campanita mobile responsive |
| #4 | FE | fix: Professional profile edit + permissions |

### 🟡 Pendiente Merge

_Ninguno por ahora_

---

## 🔄 Refactoring de DTOs

### Problema Actual

Los controladores retornan directamente entidades de dominio o respuestas de servicios, generando:
- **Acoplamiento**: Cambios en el dominio afectan la API pública
- **Seguridad**: Posible exposición de campos internos/sensibles
- **Flexibilidad**: No se puede formatear la respuesta sin modificar el dominio

### Patrón Sugerido

```
Controller → Request DTO → Service → Domain Entity → Response DTO → Client
```

### ⬜ Controladores a Revisar

- [x] **RequestsController** ✅
  - [x] Crear `RequestResponseDto` en `presentation/dto/`
  - [x] Crear `InterestedProfessionalResponseDto` en `presentation/dto/`
  - [x] `findById` - Retorna `RequestResponseDto`
  - [x] `findMyRequests` - Retorna `RequestResponseDto[]`
  - [x] `findAvailable` - Retorna `RequestResponseDto[]`
  - [x] `create` - Retorna `RequestResponseDto`
  - [x] `update` - Retorna `RequestResponseDto`
  - [x] `addPhoto` / `removePhoto` - Retorna `RequestResponseDto`
  - [x] `expressInterest` - Retorna `InterestedProfessionalResponseDto`
  - [x] `getInterestedProfessionals` - Retorna `InterestedProfessionalResponseDto[]`
  - [x] `assignProfessional` - Retorna `RequestResponseDto`
  - [x] `rateClient` - Retorna `RequestResponseDto`
  - [x] Swagger decorators actualizados con tipos de respuesta

- [x] **ProfessionalsController** ✅
  - [x] Crear `ProfessionalResponseDto` en `presentation/dto/`
  - [x] Crear `ProfessionalSearchResultDto` (sin campos sensibles como whatsapp/address)
  - [x] `search` - Retorna `ProfessionalSearchResultDto[]` (campos públicos)
  - [x] `findById` - Retorna `ProfessionalResponseDto` (datos completos)
  - [x] `getMyProfile` - Retorna `ProfessionalResponseDto`
  - [x] `createMyProfile` - Retorna `ProfessionalResponseDto`
  - [x] `updateMyProfile` - Retorna `ProfessionalResponseDto`
  - [x] `addGalleryItem` / `removeGalleryItem` - Retorna `ProfessionalResponseDto`
  - [x] Swagger decorators actualizados con tipos de respuesta

- [x] **ReviewsController** ✅
  - [x] Crear `ReviewResponseDto` en `presentation/dto/`
  - [x] Crear `PublicReviewDto` (para endpoints públicos, sin info de moderación)
  - [x] `create` - Retorna `ReviewResponseDto`
  - [x] `findById` - Retorna `ReviewResponseDto`
  - [x] `findByRequestId` - Retorna `ReviewResponseDto`
  - [x] `update` - Retorna `ReviewResponseDto`
  - [x] `delete` - Retorna void
  - [x] `findPending` (admin) - Retorna `ReviewResponseDto[]`
  - [x] `approve` / `reject` (admin) - Retorna `ReviewResponseDto`
  - [x] `ProfessionalReviewsController.findByProfessionalId` - Retorna `PublicReviewDto[]`
  - [x] Swagger decorators actualizados con tipos de respuesta

- [x] **NotificationsController** ✅ (ya tenía DTOs implementados)

- [x] **ClientsController** ✅
  - [x] `createClientProfile` - Retorna `UserProfileResponseDto`
  - [x] Swagger decorators actualizados

- [x] **Identity/AuthController** ✅ (ya tenía DTOs implementados)
  - [x] `register` / `login` - Ya usan `AuthResponseDto`
  - [x] OAuth callbacks - Redireccionan con token

- [x] **UsersController** ✅ (refactorizado)
  - [x] `getMyProfile` - Usa `UserProfileResponseDto.fromEntity()`
  - [x] `updateMyProfile` - Usa `UserProfileResponseDto.fromEntity()`
  - [x] `activateClientProfile` - Usa `UserProfileResponseDto.fromEntity()`
  - [x] Eliminado método privado `toResponseDto()` duplicado

### Consideraciones

- Los DTOs de respuesta pueden usar `class-transformer` para `@Expose()` y `@Exclude()`
- Considerar usar mappers automáticos o manuales
- Los DTOs deben vivir en `presentation/dto/`
- Un DTO puede ser reutilizado en múltiples endpoints si tiene sentido

---

## 🧪 Tests a Mejorar

- [ ] Agregar tests de integración para permisos
- [ ] Agregar tests E2E para flujos críticos:
  - [ ] Flujo completo de solicitud directa
  - [ ] Flujo completo de solicitud pública
  - [ ] Flujo de moderación de reviews
- [ ] Verificar cobertura de código

---

## 🟢 Perfil activo (MVP): reglas y restricciones

> **Objetivo:** Redefinir “activo” para Cliente, Profesional y Empresa: email y teléfono del **usuario** verificados + perfil confirmado (manual por admin). Solo perfiles activos pueden: aparecer en listado de proveedores, crear solicitudes (cliente), expresar interés (proveedor).

### Definición de “perfil activo”

Para **todos** los perfiles (Cliente, Profesional, Empresa):

- **Usuario:** `emailVerified === true` y `phoneVerified === true` (datos del **User**, no del perfil).
- **Perfil:** confirmado manualmente por admin (teléfono, email y perfil pueden ser confirmados/override por admin).
- **MVP:** Solo se usan teléfono y email del **usuario**. En perfiles (Professional/Company) los campos de contacto se consideran no requeridos y se pueden ocultar en el FE.
- **Empresa:** además tendrá validaciones extra (por definir; ej. CUIT, documentación).

**Requisitos para acciones:**

| Acción | Requisito |
|--------|-----------|
| Aparecer en listado de proveedores (`GET /providers`, búsquedas) | Perfil activo (usuario verificado + perfil confirmado por admin) |
| Cliente: crear solicitudes (`POST /requests`) | Perfil de cliente activo (email y teléfono del usuario verificados). **Aplica tanto a solicitud pública como a solicitud directa.** |
| Proveedor: expresar interés (`POST /requests/:id/interest`) | Perfil proveedor activo |

### Orden de implementación sugerido

#### Fase A: Backend – definición de “activo” y confirmación por admin

- [x] **A.1** Definir en dominio/servicios “usuario con perfil activo”:
  - [x] `UserEntity.isFullyVerified()` (emailVerified && phoneVerified). Confirmación de perfil por admin queda para más adelante.
- [x] **A.2** Admin puede confirmar manualmente:
  - [x] Endpoint: marcar teléfono del usuario como verificado (override) — `PUT /admin/users/:id/verification` con `{ phoneVerified?: boolean }`.
  - [x] Endpoint: marcar email del usuario como verificado (override) — mismo endpoint con `{ emailVerified?: boolean }`.
  - [ ] Endpoint: marcar perfil (Professional/Company/Client) como “confirmado” por admin (puede requerir nuevo campo o flag en BD).
- [x] **A.3** Restricciones por verificación (guards o validación en servicios):
  - [x] Crear solicitud (`POST /requests`): exigir perfil de cliente activo (ProfileActivationService.hasActiveClientProfile).
  - [x] Expresar interés (`POST /requests/:id/interest`): exigir perfil proveedor activo (hasActiveProviderProfile).
  - [x] Asignar proveedor (`POST /requests/:id/assign-provider`): exigir cliente activo (canAssignProviderBy usa hasActiveClientProfile).
  - [ ] Job board (`GET /requests/available`): no exige perfil activo; solo ver la lista. Expresar interés sí exige perfil activo (canExpressInterestBy).
  - [x] Listado de proveedores (`GET /providers`): solo incluir perfiles **activos** (usuario verificado + perfil canOperate). Implementado con `userVerified` en repositorios y `onlyActiveInCatalog: true` en ProvidersController. Búsquedas directas `/professionals` y `/companies` siguen mostrando por active+status sin exigir usuario verificado (comportamiento previo).
- [x] **A.4** Contacto solo en User: eliminados `phone`/`email` de Company y `whatsapp` de Professional. DTOs de creación/actualización ya no incluyen esos campos; contacto se obtiene del User (ver migración `20260206000000_remove_profile_contact_and_active`).

#### Fase B: Frontend

- [x] **B.1** Ocultar en FE los campos de teléfono/email de **perfil** (Professional/Company) o mostrarlos como no requeridos; usar solo teléfono/email del usuario para verificación y contacto en MVP.
- [x] **B.2** Pantalla de especialistas: usar **solo** `GET /providers` (unificado). La página de catálogo y nueva solicitud ya usan `useSearchProviders`.
- [x] **B.3** Mensajes claros cuando una acción se rechaza por perfil no activo (ej. "Verificá tu email y teléfono para crear una solicitud"). Implementado: crear solicitud, expresar interés (detalle y job board) con enlace Ir a mi perfil. (ej. “Verificá tu email y teléfono para crear una solicitud”).

#### Fase C: Empresa – validaciones extra (por definir)

- [ ] **C.1** Definir qué validaciones extra requiere el perfil de empresa (ej. CUIT, documentación, AFIP). Documentar en TODO o en COMPANY_PROFILES.
- [ ] **C.2** Implementar cuando estén definidas.

#### Fase D: Admin – moderación de reviews

- [ ] **D.1** **Backend:** Los endpoints de moderación ya existen: `GET /reviews/admin/pending`, `POST /reviews/:id/approve`, `POST /reviews/:id/reject` (con AdminGuard). Verificar que estén documentados en API y en el plan del portal admin.
- [ ] **D.2** **Admin portal (FE):** Agregar pantalla de moderación de reviews: listar pendientes, aprobar/rechazar. Ver [Portal de Administración](#portal-de-administración) y `docs/plans/admin-portal-plan.md`.

### Resumen rápido

- **Activo** = usuario con email + teléfono verificados (+ perfil confirmado por admin cuando se implemente).
- **MVP:** Contacto = solo usuario; perfiles sin exigir teléfono/email propios; admin puede confirmar manualmente.
- **Listado proveedores** = solo perfiles activos.
- **Crear solicitud** = cliente activo (email + teléfono verificados); **expresar interés** = proveedor activo. Crear solicitud aplica igual a solicitud pública y solicitud directa.
- **Pantalla especialistas** = usar `GET /providers`.
- **Moderación reviews** = ya en BE; falta pantalla en admin FE.

---

## 📚 Documentación Pendiente

- [x] Documentar patrón de autorización `AuthContext` + métodos de dominio
  - Creado `docs/architecture/AUTHORIZATION_PATTERN.md`
- [x] Actualizar README con nuevos endpoints
  - Companies, providers, verification, notifications; enlace a API Structure
- [x] Documentar flujos de permisos por rol (Cliente, Especialista, Admin)
  - Creado `docs/guides/PERMISSIONS_BY_ROLE.md`
- [ ] Agregar diagramas de estado de Request

---

## 🏢 Nueva Feature: Perfil de Empresa

### Descripción

Nuevo tipo de perfil para empresas (ej: constructoras, empresas de mantenimiento, etc.).
Misma funcionalidad que especialistas pero diferenciado para evolución futura.

---

### 🏗️ Arquitectura: ServiceProvider

Para desacoplar `Request` y `Review` del tipo de proveedor, introducimos una capa abstracta:

```
┌─────────────────────────────────────────────────────────────┐
│                      ServiceProvider                         │
│  - id: UUID                                                  │
│  - type: PROFESSIONAL | COMPANY                              │
│  - averageRating: Float (calculado)                          │
│  - reviewCount: Int                                          │
│  - createdAt, updatedAt                                      │
├─────────────────────────────────────────────────────────────┤
│         ▲                              ▲                     │
│         │ 1:1                          │ 1:1                 │
│    ┌────┴─────┐                  ┌─────┴─────┐               │
│    │Professional│                │  Company  │               │
│    │  - userId  │                │  - userId │               │
│    │  - bio     │                │  - name   │               │
│    │  - trades  │                │  - trades │               │
│    └────────────┘                └───────────┘               │
└─────────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │ 1:N                       │ 1:N
            ▼                           ▼
┌───────────────────────┐    ┌───────────────────────┐
│       Request         │    │        Review         │
│  - providerId (FK)    │    │  - requestId (FK)     │
│  - clientId           │    │  - serviceProviderId  │
│  - status             │    │  - rating, comment    │
└───────────────────────┘    └───────────────────────┘
```

**Beneficios:**
- ✅ FK constraints reales en BD
- ✅ Un solo campo `providerId` en Request (no `professionalId` + `companyId`)
- ✅ Reviews siempre atadas a Request completado
- ✅ Rating se agrega a ServiceProvider
- ✅ Escala a N tipos de proveedores futuros

---

### ✅ Fase 1: Migración a ServiceProvider (COMPLETADO)

#### 1.1 Schema Changes

```prisma
// NUEVO
model ServiceProvider {
  id            String       @id @default(uuid())
  type          ProviderType
  averageRating Float        @default(0)
  reviewCount   Int          @default(0)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  professional  Professional?
  company       Company?
  requests      Request[]
  reviews       Review[]
}

enum ProviderType {
  PROFESSIONAL
  COMPANY
}

// MODIFICADO
model Professional {
  id                String   @id @default(uuid())
  userId            String   @unique
  serviceProviderId String   @unique  // ← NUEVO
  serviceProvider   ServiceProvider @relation(...)
  // ... resto igual
}

// MODIFICADO
model Request {
  // ANTES: professionalId String?
  // DESPUÉS:
  providerId        String?
  provider          ServiceProvider? @relation(...)
  // ... resto igual
}

// MODIFICADO  
model Review {
  // ANTES: professionalId String
  // DESPUÉS:
  requestId         String
  request           Request @relation(...)
  serviceProviderId String   // Denormalizado para queries
  serviceProvider   ServiceProvider @relation(...)
  // ... resto igual
}
```

#### 1.2 Migración de Datos

- [ ] Crear tabla `ServiceProvider`
- [ ] Para cada `Professional` existente:
  - Crear `ServiceProvider` con `type=PROFESSIONAL`
  - Actualizar `Professional.serviceProviderId`
- [ ] Migrar `Request.professionalId` → `Request.providerId`
- [ ] Migrar `Review.professionalId` → `Review.serviceProviderId`
- [ ] Eliminar columnas viejas

#### 1.3 Domain Layer

- [ ] Crear `ServiceProviderEntity`
  ```typescript
  class ServiceProviderEntity {
    constructor(
      public readonly id: string,
      public readonly type: ProviderType,
      public readonly averageRating: number,
      public readonly reviewCount: number,
    ) {}
    
    canReceiveRequest(): boolean
    canBeReviewed(): boolean
    updateRating(newReview: Review): void
  }
  ```

- [ ] Modificar `ProfessionalEntity` para componer `ServiceProviderEntity`
- [ ] Actualizar `RequestEntity`:
  - Cambiar `professionalId` → `providerId`
  - Actualizar métodos `canXxxBy` para usar `providerId`

- [ ] Actualizar `ReviewEntity`:
  - Cambiar relación a `serviceProviderId`
  - Review siempre requiere `requestId`

#### 1.4 Application Layer

- [ ] Crear `ServiceProviderService` (queries comunes)
- [ ] Actualizar `ProfessionalService`:
  - `create()` también crea `ServiceProvider`
  - Queries incluyen `serviceProvider` relation
- [ ] Actualizar `RequestService`:
  - Cambiar `professionalId` → `providerId` en todas las operaciones
- [ ] Actualizar `ReviewService`:
  - Al crear review, actualizar `ServiceProvider.averageRating`

#### 1.5 Presentation Layer

- [ ] Actualizar DTOs (transparente para clientes API)
- [ ] Mantener backward compatibility si es necesario

---

### ⬜ Fase 2: Modelo Company

#### 2.1 Schema

```prisma
model Company {
  id                String   @id @default(uuid())
  userId            String   @unique
  serviceProviderId String   @unique
  serviceProvider   ServiceProvider @relation(...)
  user              User     @relation(...)
  
  // Datos de empresa
  companyName       String
  legalName         String?
  taxId             String?  // CUIT/RUT
  description       String?
  foundedYear       Int?
  employeeCount     Int?
  
  // Contacto
  website           String?
  phone             String?
  email             String?
  
  // Ubicación
  address           String?
  city              String?
  state             String?
  country           String?
  
  // Verificación
  verified          Boolean  @default(false)
  verifiedAt        DateTime?
  
  // Relaciones
  trades            Trade[]  @relation("CompanyTrades")
  photos            CompanyPhoto[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

#### 2.2 Domain Layer ✅

- [x] Crear `CompanyEntity` - `src/profiles/domain/entities/company.entity.ts`
  ```typescript
  class CompanyEntity {
    constructor(
      public readonly id: string,
      public readonly userId: string,
      public readonly serviceProviderId: string,
      public readonly companyName: string,
      // ... campos implementados
    ) {}
    
    // Métodos de autorización implementados
    canBeViewedBy(ctx: CompanyAuthContext): boolean
    canBeEditedBy(ctx: CompanyAuthContext): boolean
    // ... más métodos
  }
  ```

- [x] Crear `CompanyAuthContext` interface

#### 2.3 Application Layer ✅

- [x] Crear `CompanyService`
  - `createProfile(userId, data)` - crea Company + ServiceProvider
  - `updateProfile(user, id, data)` - actualiza con permisos
  - `search(params)` - búsqueda pública
  - `findById(id)` - acceso público sanitizado
  - `findByUserId(userId)` - acceso dueño
  - `addGalleryItem(user, url)` / `removeGalleryItem(user, url)`
  - `verifyCompany(user, id)` - solo admin

- [x] Crear DTOs:
  - `CreateCompanyDto`
  - `UpdateCompanyDto`
  - `SearchCompaniesDto`
  - `CompanyResponseDto`
  - `CompanySearchResultDto` (sin datos sensibles)

#### 2.4 Presentation Layer ✅

- [x] Crear `CompaniesController` - endpoints implementados:
  ```
  GET    /companies           - buscar empresas (público)
  GET    /companies/:id       - ver perfil público
  POST   /companies/me        - crear mi perfil
  PATCH  /companies/me        - actualizar mi perfil
  POST   /companies/me/gallery - agregar foto galería
  DELETE /companies/me/gallery - eliminar foto galería
  ```

#### 2.5 Identity Integration ✅

- [x] Agregar a `User`:
  ```prisma
  model User {
    // existente
    company           Company?
  }
  ```

- [x] Actualizar `UserEntity`:
  - Agregar `hasCompanyProfile: boolean`
  - Métodos: `isCompany()`, `isServiceProvider()`, `hasAnyProviderProfile()`, `canCreateCompanyProfile()`

- [x] Actualizar `/users/me` response con `hasCompanyProfile`

#### 2.6 Notifications

- [x] Actualizar handlers para soportar Company como provider
- [x] Notificaciones cuando empresa recibe interés/asignación
- [x] Actualizar eventos con `serviceProviderId`, `providerUserId`, `providerType`
- [x] Documentar cambios en `docs/guides/NOTIFICATIONS.md`

---

### ✅ Fase 3: Testing

- [x] Actualizar tests existentes para nuevo schema (completado)
- [x] Tests unitarios para `ServiceProviderEntity` (20 tests)
- [x] Tests unitarios para `CompanyEntity` (31 tests)
- [ ] Tests de integración para migración
- [x] Tests E2E para flujo completo de empresa
  - [x] `test/test-setup.ts` - Infraestructura y helpers para E2E
  - [x] `test/companies.e2e-spec.ts` - CRUD, búsqueda, galería, verificación
  - [x] `test/requests.e2e-spec.ts` - Flujo completo de interest (Professional + Company)
- [ ] Agregar E2E tests al CI pipeline (GitHub Actions con PostgreSQL service)

### ✅ Fase 4: Documentación

- [x] Actualizar `docs/API.md` con endpoints de Companies
- [x] Crear `docs/decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md`
- [x] Actualizar `docs/README.md` con nueva estructura

---

### ✅ Reglas de Negocio - Dual Profile

#### Dual Profile: Professional + Company

> 📖 **Diseño completo:** [docs/architecture/COMPANY_PROFILES.md](./docs/architecture/COMPANY_PROFILES.md)

**Resumen de decisiones:**
- Solo UN perfil proveedor activo a la vez (Professional XOR Company)
- Al verificar Company → Professional se desactiva automáticamente
- Usuario puede alternar entre perfiles desde dashboard
- CUIT único (error si ya existe)
- Company usa mismos flujos que Professional (Job Board, Reviews, Solicitudes)

**Implementación Backend ✅:**
- [x] Lógica de activación/desactivación de perfiles (`ProfileActivationPolicy` + `ProfileToggleService`)
- [x] Validación de CUIT único (en `CompanyService.createProfile`)
- [x] Endpoints para toggle de perfil:
  - `POST /api/professionals/me/activate` - Activar perfil profesional
  - `POST /api/companies/me/activate` - Activar perfil empresa
  - `GET /api/users/me/provider-profiles` - Ver estado de ambos perfiles
- [x] Catálogo unificado con filtro (`GET /api/providers?providerType=ALL|PROFESSIONAL|COMPANY`)

**Pendiente Frontend:**
- [ ] Toggle de perfil activo en dashboard (FE)
- [ ] Filtro "Tipo" en catálogo de especialistas
- [ ] Badge "Empresa" en tarjetas de proveedor

---

### ✅ Arquitectura de Empresas

> 📖 **Diseño completo:** [docs/architecture/COMPANY_PROFILES.md](./docs/architecture/COMPANY_PROFILES.md)

**MVP (actual):**
- [x] Company como ServiceProvider
- [x] Estados: PENDING_VERIFICATION → ACTIVE → VERIFIED (+ INACTIVE, REJECTED, SUSPENDED)
- [x] Validación de CUIT único
- [x] Company no opera hasta ACTIVE (verificado por admin)

**Post-MVP:**
- [ ] Multi-usuario por empresa (CompanyMember con roles)
- [ ] Verificación avanzada (AFIP, documentación)
- [ ] Transferencia de ownership

---

### Consideraciones Futuras (No MVP)

- [ ] Dashboard de empresa con métricas
- [ ] Verificación de empresa (documentos legales, AFIP)
- [ ] Planes de suscripción para empresas
- [ ] Portal de empleados de la empresa
- [ ] Asignación de solicitudes a empleados específicos
- [ ] Transferencia de ownership de empresa

### Prioridad

🟡 **Media** - Implementar después de estabilizar permisos y DTOs

### Orden de Implementación Sugerido

1. **Fase 1** (ServiceProvider) - ~2-3 días
2. **Fase 2** (Company model) - ~2-3 días  
3. **Fase 3** (Testing) - ~1-2 días
4. **Frontend** - ~3-4 días

**Total estimado: ~10-12 días**

---

## 🚀 Mejoras Futuras (Backlog)

### Performance
- [ ] Revisar N+1 queries en listados
- [ ] Implementar caché para perfiles públicos
- [ ] Optimizar queries de notificaciones

### Seguridad
- [ ] Rate limiting por endpoint
- [ ] Validación de inputs más estricta
- [ ] Audit log para acciones administrativas

### UX / Soporte
- [ ] **Botón "Reportar un problema"**
  - Agregar botón en la app (ubicación y flujo por definir).
  - Lógica, backend y canal de reporte por definir más adelante.

### Verificación de Usuario (Email & Teléfono) ✅
- [x] **Validación de Email**
  - Implementado flujo de verificación usando Twilio Verify
  - Agregado campo `emailVerified: boolean` a User
  - Endpoints: `POST /identity/verification/email/request` y `/confirm`
  
- [x] **Validación de Teléfono**
  - Implementado flujo de verificación usando Twilio Verify
  - Agregado campo `phoneVerified: boolean` a User
  - Endpoints: `POST /identity/verification/phone/request` y `/confirm`
  - Validación de formato E.164 para números telefónicos
  - Invalidación automática cuando cambia el teléfono/email

- [ ] **Tests para Verificación**
  - [x] Tests unitarios para `VerificationService` (application layer)
  - [ ] Tests unitarios para `TwilioVerifyService` (infrastructure layer)
  - [ ] Tests unitarios para `Phone` value object
  - [ ] Tests de integración para endpoints de verificación
  - [ ] Tests E2E para flujo completo de verificación de teléfono
  - [ ] Tests E2E para flujo completo de verificación de email
  - [x] Tests de validación: prevenir código si ya está verificado (cubierto en VerificationService spec)
  - [ ] Tests de invalidación: verificar que se invalida al cambiar teléfono/email

- [ ] **Deployment y Configuración**
  - [ ] Subir credenciales de Twilio a fly.io (secrets)
    - `TWILIO_ACCOUNT_SID`
    - `TWILIO_AUTH_TOKEN`
    - `TWILIO_VERIFY_SERVICE_SID`

- [ ] **Restricciones de Acciones por Verificación** → Ver sección [Perfil activo (MVP)](#-perfil-activo-mvp-reglas-y-restricciones)
  - Requisito unificado: **perfil activo** = usuario con email + teléfono verificados (+ perfil confirmado por admin).
  - Acciones que requieren perfil activo: crear solicitud (cliente), expresar interés (proveedor), aparecer en listado de proveedores.
  - [ ] Implementar guards/validación en servicios según fases A.2 y A.3 de la sección Perfil activo.

### Notificaciones y Comunicaciones
- [ ] **Notificar a clientes cuando un proveedor cambia teléfono o email (mejora)**
  - Cuando un provider (Professional o Company) actualiza su número de teléfono o email en el usuario, notificar a los clientes de los **requests activos** en los que ese proveedor participa (asignado o con interés expresado).
  - Permite que el cliente tenga el dato de contacto actualizado para solicitudes en curso.
- [ ] **Integración de Twilio WhatsApp en Notificaciones**
  - [ ] Incorporar Twilio al módulo de notificaciones
  - [ ] Crear adapter para envío de mensajes por WhatsApp usando Twilio API
  - [ ] Agregar canal `WHATSAPP` a tipos de notificación
  - [ ] Configurar preferencias de usuario para recibir notificaciones por WhatsApp
  - [ ] Validar que usuario tenga teléfono verificado antes de enviar por WhatsApp
  - [ ] Implementar fallback a email si WhatsApp falla
  - [ ] Agregar tests para envío de notificaciones por WhatsApp

- [ ] **Follow-up Interactivo por WhatsApp**
  - [ ] **Tracking de clicks en botón de WhatsApp**
    - [ ] Crear endpoint para registrar click en botón de contacto por WhatsApp
    - [ ] Modelo de datos para almacenar eventos de click (RequestContactClick)
      - Campos: requestId, clickedByUserId, providerId (quien fue contactado), timestamp, source (client/professional)
    - [ ] Integrar tracking en frontend: llamar endpoint cuando se hace click en botón WhatsApp
    - [ ] Agregar tracking tanto para clicks desde cliente hacia provider como viceversa
    - [ ] Considerar usar eventos de dominio para desacoplar tracking del flujo principal
  - [ ] Investigar funcionalidad de follow-up automático para Requests
  - [ ] Definir triggers: tiempo sin actividad después del primer contacto
  - [ ] Usar datos de tracking para determinar cuándo hacer follow-up (ej: si hubo click pero no respuesta)
  - [ ] Diseñar flujo de preguntas interactivas por WhatsApp
  - [ ] Implementar webhook endpoint para recibir respuestas de Twilio
  - [ ] Procesar respuestas y actualizar estado del Request según respuesta
  - [ ] Crear sistema de templates de mensajes para follow-up
  - [ ] Agregar configuración de tiempos de follow-up (ej: 3 días, 7 días)
  - [ ] Implementar lógica para evitar múltiples follow-ups
  - [ ] Agregar tests para webhook de Twilio y procesamiento de respuestas
  - [ ] Agregar tests para tracking de clicks
  - [ ] Documentar flujo completo de follow-up interactivo

### UX
- [ ] Notificaciones push (web)
- [ ] Tiempo real con WebSockets
- [ ] Búsqueda avanzada de especialistas

### Portal de Administración

> 📖 **Plan completo:** [docs/plans/admin-portal-plan.md](./docs/plans/admin-portal-plan.md)

**Estado:** Planificación - Pendiente decidir stack tecnológico FE/UI

**Decisiones pendientes:**
- [ ] Decidir stack tecnológico frontend (Next.js, React Admin, AdminJS, Shadcn UI)
- [ ] Decidir UI framework/component library
- [ ] Definir funcionalidades básicas MVP
- [ ] Crear mockups/wireframes básicos

**Funcionalidades MVP planificadas:**
- [ ] Dashboard con métricas y KPIs
- [ ] Gestión de usuarios (listar, ver, editar, cambiar estado, confirmar email/teléfono manualmente)
- [ ] Gestión de solicitudes (listar, ver, acciones administrativas)
- [ ] Gestión de perfiles profesionales y empresas (verificar, suspender, confirmar perfil)
- [ ] **Moderación de reviews pendientes** — Backend ya tiene: `GET /reviews/admin/pending`, `POST /reviews/:id/approve`, `POST /reviews/:id/reject`. Falta pantalla en admin FE (ver sección [Perfil activo (MVP)](#-perfil-activo-mvp-reglas-y-restricciones), Fase D).
- [ ] Gestión de notificaciones (estadísticas, reenviar fallidas)

**Fases de implementación:**
- [ ] Fase 1: Setup y Autenticación
- [ ] Fase 2: Dashboard y Gestión de Usuarios
- [ ] Fase 3: Gestión de Solicitudes y Perfiles
- [ ] Fase 4: Moderación y Notificaciones
- [ ] Fase 5: Polish y Mejoras

### Soporte y Chat
- [ ] **Chat con Administrador en Request**
  - [ ] Agregar botón de chat con administrador en pantalla de detalle de request
  - [ ] Botón visible tanto para clientes como para especialistas
  - [ ] Implementar sistema de chat/mensajería con administradores
  - [ ] Considerar opciones:
    - Integración con servicio de chat externo (Intercom, Crisp, etc.)
    - Chat interno con notificaciones a administradores
    - Sistema de tickets de soporte
  - [ ] Contexto del chat debe incluir información del request (ID, título, estado)
  - [ ] Permitir que usuarios reporten problemas específicos del request
  - [ ] Notificaciones a administradores cuando hay nuevos mensajes
  - [ ] Panel de administración para gestionar conversaciones de soporte
  - [ ] Agregar tests para funcionalidad de chat
  - [ ] Documentar flujo de soporte

---

## 📅 Prioridades Sugeridas

### Corto plazo
1. Avanzar con [Perfil activo (MVP)](#-perfil-activo-mvp-reglas-y-restricciones): Fase A (backend) y Fase D (moderación reviews en admin FE).
2. Confirmar/migrar pantalla de especialistas a usar solo `GET /providers` (FE).

### Esta Semana
1. ~~Crear PRs pendientes~~ ✅ BE #10, #11 | FE #3, #4
2. ~~Merge de PRs existentes~~ ✅
3. Revisar módulo de Reviews (permisos de moderación)

### Próxima Semana
1. ~~Refactorizar Notifications module~~ ✅
2. ~~Revisar Profiles module~~ ✅
3. ~~Revisar Identity module~~ ✅
4. Revisar DTOs en controladores principales

### Mes
1. DTOs completos en todos los controladores
2. Documentación de arquitectura
3. Tests E2E
4. Perfil activo: restricciones por verificación y confirmación admin (Fases A–B)

---

## 📌 Notas

- El patrón de `AuthContext` puede ser extraído a un módulo compartido
- Considerar crear un guard de NestJS genérico para permisos comunes
- Los métodos `canXxxBy()` en entidades siguen el principio de "tell, don't ask"

