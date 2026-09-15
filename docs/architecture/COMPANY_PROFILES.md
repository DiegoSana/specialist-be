# Company Profiles - Diseño y Arquitectura

> Última actualización: 2026-09-15

## Resumen

Este documento describe el diseño del sistema de perfiles de empresa, incluyendo la relación con perfiles profesionales individuales, flujos de registro, y reglas de negocio.

---

## Decisiones de Arquitectura

### Catálogo Unificado con Filtro

El catálogo de especialistas muestra tanto Professionals como Companies en una vista unificada.

- **Filtro disponible:** Todos | Individual | Empresa
- **Badge visual:** Las empresas muestran badge "Empresa" distintivo
- **Mismo endpoint de búsqueda** con query param `providerType`

### Solo Un Perfil Activo (Professional XOR Company)

Un usuario puede tener ambos perfiles, pero **solo uno puede estar activo** a la vez.

```
┌─────────────────────────────────────────┐
│            Usuario                       │
├─────────────────────────────────────────┤
│  ├── Perfil Cliente (independiente)     │
│  │                                       │
│  └── Perfil Proveedor (solo 1 operando) │
│       ├── Professional (ProfessionalStatus)│
│       └── Company (CompanyStatus)       │
└─────────────────────────────────────────┘
```

**Regla:** Si se activa Professional → se desactiva Company (y viceversa). "Operando" = `status` en `ACTIVE` o `VERIFIED` (`canOperate()`); el perfil desplazado pasa a `INACTIVE`.

Implementación:
- `ProfileActivationPolicy` (`src/profiles/domain/services/profile-activation.policy.ts`): reglas puras de dominio (`resolveActivation`, `resolveCompanyVerification`, `getActiveProfile`). Si ambos perfiles llegaran a operar, Company tiene prioridad en `getActiveProfile`.
- `ProfileToggleService` (`src/profiles/application/services/profile-toggle.service.ts`): aplica el resultado de la policy sobre los repositorios (desactiva primero, activa después).
- Endpoints: `POST /professionals/me/activate`, `POST /companies/me/activate`, `GET /users/me/provider-profiles` (devuelve ambos perfiles y `activeType`).

Para que el perfil cuente como **activo** de cara a la API (catálogo `GET /providers`, expresar interés, ser asignado) además el usuario debe tener email y teléfono verificados. Esa composición la hace `ProfileActivationService`; ver [PROFILE_ACTIVATION_ORCHESTRATION.md](./PROFILE_ACTIVATION_ORCHESTRATION.md).

---

## Flujos de Usuario

### 1. Registro Inicial

```
┌─────────────────────────────────────────────────────────┐
│                    REGISTRO                              │
├─────────────────────────────────────────────────────────┤
│  ¿Qué querés hacer en Specialist?                       │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ 🔍 Buscar   │  │ 👤 Ofrecer  │  │ 🏢 Ofrecer  │      │
│  │  servicios  │  │  servicios  │  │  como       │      │
│  │  (Cliente)  │  │ (Individual)│  │  empresa    │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### 2. Professional que crea Empresa

```
1. Usuario tiene Professional (ACTIVE) con historial de reviews
2. Crea Company (`POST /companies/me`) → Company queda PENDING_VERIFICATION
   ⚠️ Warning: "Tu perfil profesional se desactivará cuando la empresa sea verificada"
3. Professional sigue ACTIVE mientras Company está PENDING_VERIFICATION
4. Admin verifica Company (`POST /companies/:id/verify`; valida CUIT + nombre)
5. Company → ACTIVE, Professional → INACTIVE automáticamente
   (`CompanyService.verifyCompany` → `ProfileToggleService.handleCompanyVerification`)
6. Reviews y trabajos del Professional quedan en su historial (separados)
7. Company empieza con 0 reviews (historial independiente)
```

### 3. Alternancia entre Perfiles

El usuario puede alternar entre perfiles activos desde su dashboard:

```
Dashboard
├── Mi perfil activo: [Juan Plomería SRL] 🏢
│   └── [Cambiar a perfil individual]  → POST /professionals/me/activate
│
└── Perfil inactivo: Juan Pérez (15 reviews, ⭐4.8)
    └── Al activar: Company → INACTIVE
        Volver a la empresa → POST /companies/me/activate (INACTIVE → ACTIVE)
```

No existe endpoint explícito de "desactivar": un perfil se desactiva al activar el otro (o por cambio de estado de admin).

### 4. Empresa ya existente

```
1. Dueño se registra
2. Crea Company con datos de la empresa
3. Company → PENDING_VERIFICATION
4. Admin verifica (CUIT único, nombre)
5. Company → ACTIVE
6. El dueño es el único `userId` asociado (1:1). Roles/miembros de empresa son futuro, ver más abajo.
```

---

## Reglas de Negocio

### Unicidad de Empresa

| Campo | Regla |
|-------|-------|
| CUIT | Único en el sistema |
| Nombre | No necesariamente único (dos "Construcciones Sur" pueden existir) |

**Si CUIT ya existe:** Error "Esta empresa ya está registrada"

### Verificación de Company

**MVP:**
- CUIT (formato argentino: XX-XXXXXXXX-X)
- Nombre de empresa

**Futuro:**
- Constancia de inscripción AFIP
- Poder del representante legal
- Domicilio fiscal

**Timeout:** Ninguno por ahora. Futuro: reminder a admin si pendientes > X días.

### Estados de Company

Enum `CompanyStatus` (`prisma/schema.prisma`, mismos valores que `ProfessionalStatus`):

```prisma
enum CompanyStatus {
  PENDING_VERIFICATION // Awaiting admin verification (default al crear)
  ACTIVE               // Verified, can operate
  VERIFIED             // Verified + special badge
  INACTIVE             // Deactivated (user has Professional active)
  REJECTED             // Verification failed
  SUSPENDED            // Admin suspended
}
```

Transiciones implementadas:

```
(crear)  POST /companies/me
   └──► PENDING_VERIFICATION

PENDING_VERIFICATION ──► ACTIVE        POST /companies/:id/verify (admin);
                                       si el Professional del usuario opera → Professional INACTIVE
ACTIVE | VERIFIED   ──► INACTIVE       POST /professionals/me/activate (el Professional pasa a operar)
INACTIVE            ──► ACTIVE         POST /companies/me/activate;
                                       si el Professional opera → Professional INACTIVE
PENDING_VERIFICATION──► (400)          POST /companies/me/activate: el admin debe verificar primero
REJECTED | SUSPENDED──► (400)          POST /companies/me/activate: no se puede activar

cualquiera          ──► cualquiera     PUT /admin/companies/:id/status (admin). Única vía hacia
                                       VERIFIED, SUSPENDED y REJECTED. Sin chequeo XOR.
```

| Estado | Descripción | `canOperate()` | Se puede activar (`POST /companies/me/activate`) |
|--------|-------------|----------------|--------------------------------------------------|
| PENDING_VERIFICATION | Recién creada, esperando verificación | ❌ | ❌ (400: el admin debe verificar primero) |
| ACTIVE | Verificada, puede operar | ✅ | ✅ (no-op) |
| VERIFIED | Verificada + badge especial (`hasVerifiedBadge()`) | ✅ | ✅ (no-op) |
| INACTIVE | Desactivada porque el Professional del usuario está operando | ❌ | ✅ → ACTIVE (desactiva Professional) |
| REJECTED | Verificación fallida | ❌ | ❌ (400) |
| SUSPENDED | Suspendida por admin | ❌ | ❌ (400) |

Reglas (código):

- `CompanyEntity` (`src/profiles/domain/entities/company.entity.ts`): `canOperate()` = `ACTIVE || VERIFIED`; `canBeActivated()` = `PENDING_VERIFICATION || INACTIVE || ACTIVE || VERIFIED` (capacidad del estado en sí; la policy además bloquea la auto-activación desde `PENDING_VERIFICATION`); `canBeDeactivated()` = `ACTIVE || VERIFIED`. `isActive()` e `isActiveAndVerified()` están `@deprecated` y son alias de `canOperate()`.
- `CompanyService.verifyCompany(admin, id)`: sólo desde `PENDING_VERIFICATION`; pasa a `ACTIVE` y, si el Professional del usuario está operando, lo deja `INACTIVE` (`ProfileActivationPolicy.resolveCompanyVerification`).
- `CompanyService.activateCompanyProfile(userId)` → `ProfileToggleService.activateCompanyProfile`: aplica la tabla anterior; si activa, desactiva el Professional operando.
- `CompanyService.updateStatus(id, status, admin)` (`PUT /admin/companies/:id/status`): cambio libre de estado por admin (`canChangeStatusBy` → sólo `isAdmin`). Es la única forma de llegar a `VERIFIED` o `SUSPENDED`. No aplica la regla XOR: el admin es responsable de no dejar Professional y Company operando a la vez.
- Al reactivar una Company `INACTIVE` el estado resultante es siempre `ACTIVE`, aunque antes fuera `VERIFIED` (el badge se pierde y debe reasignarlo un admin).
- No hay borrado de Company; los estados terminales del lado del usuario son `REJECTED` y `SUSPENDED`.

---

## Flujos Operativos

### Job Board (Bolsa de Trabajo)

Company funciona igual que Professional:
- Ve requests públicos de sus rubros
- Puede expresar interés
- Aparece en lista de interesados con badge "Empresa"

### Solicitud Directa

Cliente puede enviar solicitud directa a Company (igual que a Professional).

### Reviews

- Reviews se asocian al ServiceProvider (`Review.serviceProviderId`)
- Company y Professional tienen historiales independientes
- Mismo flujo de moderación (PENDING → APPROVED/REJECTED), ver [REVIEW_MODERATION.md](../guides/REVIEW_MODERATION.md)
- Pendiente: al aprobar una review, `ReviewService` sólo recalcula `averageRating`/`totalReviews` para Professional (`TODO` en `updateServiceProviderRating`); `CompanyService.updateRating` existe pero aún no está cableado.

---

## Modelo de Datos

```
ServiceProvider (abstracción, tabla service_providers)
├── id
├── type: PROFESSIONAL | COMPANY
├── averageRating
├── totalReviews
├── requests[] (como proveedor asignado), reviews[], interests[]
│
├── Professional? (1:1, serviceProviderId único)
│   ├── userId (único)
│   ├── status: ProfessionalStatus (PENDING_VERIFICATION | ACTIVE | VERIFIED | INACTIVE | REJECTED | SUSPENDED)
│   ├── description, experienceYears, city, zone, address, website
│   ├── profileImage, gallery[]
│   └── trades[] (ProfessionalTrade)
│
└── Company? (1:1, serviceProviderId único)
    ├── userId (único)
    ├── companyName
    ├── legalName?
    ├── taxId? (CUIT, único si está presente)
    ├── description?, foundedYear?, employeeCount? ("1-5", "6-20", "21-50", "50+")
    ├── website?
    ├── address?, city (default "Bariloche"), zone?
    ├── status: CompanyStatus (ver arriba)
    ├── profileImage?, gallery[]
    └── trades[] (CompanyTrade, con isPrimary)
```

**Contacto:** Company **no** tiene `phone`, `email` ni `whatsapp`; el contacto es siempre el del `User` dueño (`user.phone`, `user.email`). Tampoco existe un booleano `active`: operar depende únicamente de `status`. Ambas cosas se eliminaron en la migración `20260206000000_remove_profile_contact_and_active` (también para Professional). El nombre a mostrar es `companyName` (`displayName` es un getter de la entidad).

---

## Futuro (Post-MVP)

### Multi-Usuario por Empresa

> ⚠️ **No implementado.** `CompanyMember` y `CompanyRole` **no existen** en `prisma/schema.prisma` ni en el código. Hoy la relación User ↔ Company es 1:1 (`Company.userId @unique`) y el dueño es el único que puede editar el perfil (`CompanyEntity.canBeEditedBy`: dueño o admin). Lo siguiente es una propuesta:

```prisma
// PROPUESTA (futuro) - no está en el schema
model CompanyMember {
  id        String      @id
  companyId String
  userId    String
  role      CompanyRole // OWNER, ADMIN, MEMBER
  invitedAt DateTime
  joinedAt  DateTime?
}
```

- OWNER: quien registró (único, no transferible inicialmente)
- ADMIN: puede gestionar empresa y miembros
- MEMBER: puede actuar en nombre de la empresa

### Verificación Avanzada

- Documentación legal automatizada
- Integración con AFIP para validar CUIT
- Verificación de domicilio

### Transferencia de Ownership

- Proceso formal para cambiar dueño de empresa
- Requiere verificación de identidad

---

## Referencias

- [ADR-004: ServiceProvider Abstraction](../decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md)
- [ADR-001: Dual Profile Architecture](../decisions/ADR-001-DUAL-PROFILE-ARCHITECTURE.md)

