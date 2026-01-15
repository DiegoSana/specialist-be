# 🔧 Tareas Pendientes - Specialist Backend

> Última actualización: 2026-01-15

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

## 📚 Documentación Pendiente

- [x] Documentar patrón de autorización `AuthContext` + métodos de dominio
  - Creado `docs/architecture/AUTHORIZATION_PATTERN.md`
- [ ] Actualizar README con nuevos endpoints
- [ ] Documentar flujos de permisos por rol (Cliente, Especialista, Admin)
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

### ✅ Fase 4: Documentación

- [x] Actualizar `docs/API.md` con endpoints de Companies
- [x] Crear `docs/decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md`
- [x] Actualizar `docs/README.md` con nueva estructura

---

### Consideraciones Futuras (No MVP)

- [ ] Múltiples empleados por empresa con roles
- [ ] Dashboard de empresa con métricas
- [ ] Verificación de empresa (documentos legales)
- [ ] Planes de suscripción para empresas
- [ ] Portal de empleados de la empresa
- [ ] Asignación de solicitudes a empleados específicos

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

### UX
- [ ] Notificaciones push (web)
- [ ] Tiempo real con WebSockets
- [ ] Búsqueda avanzada de especialistas

---

## 📅 Prioridades Sugeridas

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

---

## 📌 Notas

- El patrón de `AuthContext` puede ser extraído a un módulo compartido
- Considerar crear un guard de NestJS genérico para permisos comunes
- Los métodos `canXxxBy()` en entidades siguen el principio de "tell, don't ask"

