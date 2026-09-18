# Estructura de la API - Specialist

> Documentación completa sobre la organización de endpoints, autenticación y clientes

## 📋 Tabla de Contenidos

1. [Organización de Endpoints](#organización-de-endpoints)
2. [Tipos de Autenticación](#tipos-de-autenticación)
3. [Clientes y Contextos](#clientes-y-contextos)
4. [Guards y Decoradores](#guards-y-decoradores)

---

## 1. Organización de Endpoints

La API está organizada en **bounded contexts** con prefijos específicos:

### 1.1 Endpoints Públicos (Sin Autenticación)

Estos endpoints **NO requieren** token JWT:

| Contexto | Endpoint | Descripción |
|----------|----------|-------------|
| **Auth** | `POST /api/auth/register` | Registro de usuario |
| **Auth** | `POST /api/auth/login` | Login con email/password |
| **Auth** | `GET /api/auth/google` | Iniciar OAuth Google |
| **Auth** | `GET /api/auth/facebook` | Iniciar OAuth Facebook |
| **Profiles** | `GET /api/professionals` | Buscar profesionales |
| **Profiles** | `GET /api/professionals/:id` | Ver perfil profesional |
| **Profiles** | `GET /api/companies` | Buscar empresas |
| **Profiles** | `GET /api/companies/:id` | Ver perfil de empresa |
| **Profiles** | `GET /api/trades` | Listar trades |
| **Reputation** | `GET /api/professionals/:id/reviews` | Reviews aprobadas de un profesional |
| **Storage** | `GET /api/storage/public/*` | Archivos públicos |
| **Health** | `GET /api/health` | Health check |

**Marcado con decorador `@Public()`** en los controllers.

---

### 1.2 Endpoints de Usuario (Autenticación JWT)

Estos endpoints requieren **token JWT** en el header `Authorization: Bearer <token>`.

#### 🔐 Identity (`/auth`, `/users`)

| Endpoint | Método | Descripción | Rol Requerido |
|----------|--------|-------------|----------------|
| `/api/users/me` | `GET` | Obtener mi perfil | Cualquier usuario autenticado |
| `/api/users/me` | `PATCH` | Actualizar mi perfil | Cualquier usuario autenticado |
| `/api/users/me/client-profile` | `POST` | Activar perfil de cliente | Cualquier usuario autenticado |

#### 👷 Profiles - Professionals (`/professionals`)

| Endpoint | Método | Descripción | Rol Requerido |
|----------|--------|-------------|----------------|
| `/api/professionals/me/profile` | `GET` | Ver mi perfil profesional | Usuario con perfil profesional |
| `/api/professionals/me` | `POST` | Crear perfil profesional | Cualquier usuario autenticado |
| `/api/professionals/me` | `PATCH` | Actualizar mi perfil profesional | Usuario con perfil profesional |
| `/api/professionals/me/gallery` | `POST` | Agregar foto a galería | Usuario con perfil profesional |
| `/api/professionals/me/gallery` | `DELETE` | Eliminar foto de galería | Usuario con perfil profesional |

#### 🏢 Profiles - Companies (`/companies`)

| Endpoint | Método | Descripción | Rol Requerido |
|----------|--------|-------------|----------------|
| `/api/companies/me/profile` | `GET` | Ver mi perfil de empresa | Usuario con perfil de empresa |
| `/api/companies/me` | `POST` | Crear perfil de empresa | Cualquier usuario autenticado |
| `/api/companies/me` | `PATCH` | Actualizar mi perfil de empresa | Usuario con perfil de empresa |
| `/api/companies/me/gallery` | `POST` | Agregar foto a galería | Usuario con perfil de empresa |
| `/api/companies/me/gallery` | `DELETE` | Eliminar foto de galería | Usuario con perfil de empresa |

#### 📋 Requests (`/requests`)

**Todos los endpoints requieren autenticación JWT.**

| Endpoint | Método | Descripción | Rol Requerido |
|----------|--------|-------------|----------------|
| `/api/requests` | `GET` | Obtener mis requests | Cualquier usuario autenticado |
| `/api/requests` | `POST` | Crear nuevo request | Usuario con perfil de cliente |
| `/api/requests/available` | `GET` | Requests disponibles (job board) | Usuario con perfil profesional/empresa |
| `/api/requests/:id` | `GET` | Ver detalles de request | Usuario autenticado (con permisos) |
| `/api/requests/:id` | `PATCH` | Actualizar request | Cliente dueño del request |
| `/api/requests/:id/accept` | `POST` | Aceptar cotización | Cliente dueño del request |
| `/api/requests/:id/photos` | `POST` | Agregar foto | Cliente dueño del request |
| `/api/requests/:id/photos` | `DELETE` | Eliminar foto | Cliente dueño del request |
| `/api/requests/:id/interest` | `POST` | Expresar interés | Usuario con perfil profesional/empresa |
| `/api/requests/:id/interest` | `DELETE` | Remover interés | Usuario con perfil profesional/empresa |
| `/api/requests/:id/interest` | `GET` | Ver mi estado de interés | Usuario con perfil profesional/empresa |
| `/api/requests/:id/interests` | `GET` | Listar interesados | Cliente dueño del request |
| `/api/requests/:id/assign` | `POST` | Asignar proveedor | Cliente dueño del request |

#### ⭐ Reputation (`/reviews`)

| Endpoint | Método | Descripción | Rol Requerido |
|----------|--------|-------------|----------------|
| `/api/reviews` | `POST` | Crear review (status: PENDING) | Usuario autenticado |
| `/api/reviews` | `GET` | Obtener review por requestId | Usuario autenticado |
| `/api/reviews/:id` | `GET` | Obtener review por ID | Usuario autenticado |
| `/api/reviews/:id` | `PATCH` | Actualizar review | Autor del review |
| `/api/reviews/:id` | `DELETE` | Eliminar review | Autor del review |

#### 🔔 Notifications (`/notifications`)

| Endpoint | Método | Descripción | Rol Requerido |
|----------|--------|-------------|----------------|
| `/api/notifications` | `GET` | Listar mis notificaciones | Cualquier usuario autenticado |
| `/api/notifications/:id/read` | `PATCH` | Marcar como leída | Usuario dueño de la notificación |
| `/api/notifications/read-all` | `PATCH` | Marcar todas como leídas | Cualquier usuario autenticado |
| `/api/notifications/preferences` | `GET` | Obtener preferencias | Cualquier usuario autenticado |
| `/api/notifications/preferences` | `PUT` | Actualizar preferencias | Cualquier usuario autenticado |

#### 📁 Storage (`/storage`)

| Endpoint | Método | Descripción | Rol Requerido |
|----------|--------|-------------|----------------|
| `/api/storage/upload` | `POST` | Subir archivo | Cualquier usuario autenticado |
| `/api/storage/private/*` | `GET` | Obtener archivo privado | Usuario con permisos |
| `/api/storage/*` | `DELETE` | Eliminar archivo | Usuario dueño del archivo |

#### 📞 Contact (`/contact`)

| Endpoint | Método | Descripción | Rol Requerido |
|----------|--------|-------------|----------------|
| `/api/contact` | `POST` | Crear solicitud de contacto | Cualquier usuario autenticado |
| `/api/contact` | `GET` | Obtener mis contactos | Cualquier usuario autenticado |

---

### 1.3 Endpoints de Admin (`/admin`)

**Todos requieren:**
- ✅ Token JWT válido
- ✅ `isAdmin: true` en el payload del token
- ✅ Guard `AdminGuard`

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/admin/users` | `GET` | Listar todos los usuarios (paginado, `search` opcional sobre email/firstName/lastName). Cada item incluye `isAdmin`, `hasClientProfile`, `hasProfessionalProfile`, `hasCompanyProfile`, `updatedAt` |
| `/api/admin/users/:id` | `GET` | Obtener usuario por ID |
| `/api/admin/users/:id/status` | `PUT` | Actualizar estado de usuario |
| `/api/admin/users/:id/verification` | `PUT` | Confirmar email/teléfono manualmente (body: `emailVerified?`, `phoneVerified?`) |
| `/api/admin/professionals` | `GET` | Listar todos los profesionales (paginado) |
| `/api/admin/professionals/:id` | `GET` | Obtener profesional por ID |
| `/api/admin/professionals/:id/status` | `PUT` | Actualizar estado de profesional |
| `/api/admin/requests` | `GET` | Listar todos los requests (paginado, filtro opcional). `provider` de cada item: `{ id, type: 'PROFESSIONAL' \| 'COMPANY', name } \| null` |
| `/api/admin/requests/:id` | `GET` | Detalle completo del request: `client`, `trade`, `provider` unificado (con `trades` para Professional/Company) e `interestedProviders`. Sin el chequeo de `canBeViewedBy` de participantes - cualquier admin puede ver cualquier request |
| `/api/admin/notifications` | `GET` | Listar todas las notificaciones |
| `/api/admin/notifications/stats` | `GET` | Estadísticas de notificaciones |
| `/api/admin/notifications/email-status` | `GET` | Proveedor de email activo: `{ provider: 'smtp' \| 'mailgun' \| 'ethereal', ethereal?: { loginUrl, user, pass } }` (credenciales live de Ethereal, se regeneran en cada boot) |
| `/api/admin/notifications/:id/resend` | `POST` | Reenviar notificación fallida |
| `/api/admin/whatsapp/config` | `GET` | `{ devMode, availableFollowUpRules? }` |
| `/api/admin/whatsapp/conversations` | `GET` | Listar conversaciones de WhatsApp (paginado, `search` opcional) |
| `/api/admin/whatsapp/conversations/:requestId` | `GET` | Hilo completo de mensajes de WhatsApp de una solicitud |
| `/api/admin/whatsapp/conversations/:requestId/simulate-reply` | `POST` | Simular una respuesta entrante de WhatsApp (solo dev mode, 404 si no) |
| `/api/admin/whatsapp/conversations/:requestId/trigger-followup` | `POST` | Disparar una regla de follow-up ahora mismo (solo dev mode, 404 si no) |
| `/api/admin/requests/attention` | `GET` | Listar `RequestAttentionFlag`s abiertos (paginado, `?page=&limit=`), con título/status del request. Razones: `AT_RISK` (escalera de follow-up agotada sin respuesta), `ABANDONED`/`ESCALATED` (señal del clasificador LLM) |
| `/api/admin/requests/attention/:id/resolve` | `POST` | Marcar un flag como resuelto (204) - no toca el request en sí, el seguimiento es manual vía el visor de conversaciones |
| `/api/admin/support/conversations` | `GET` | Listar conversaciones de soporte (paginado, `?status=OPEN\|RESOLVED\|ALL&page=&limit=`). Cada item incluye `canReplyNow` (ventana de 24hs, calculado en el server) |
| `/api/admin/support/conversations/:id` | `GET` | `{ conversation, messages }` - mensajes en orden cronológico (viejo→nuevo), a diferencia de `/admin/whatsapp/conversations/:requestId` |
| `/api/admin/support/conversations/:id/reply` | `POST` | Responder (body: `message`, 1-1500 caracteres) - 201 con el mensaje creado, o 400 `{ code: 'WHATSAPP_WINDOW_EXPIRED', message, lastInboundAt }` fuera de la ventana de 24hs |
| `/api/admin/support/conversations/:id/resolve` | `POST` | Marcar la conversación como resuelta (204, idempotente) |
| `/api/admin/support/conversations/:id/reopen` | `POST` | Reabrir una conversación resuelta (204, idempotente) |

**Marcado con `@UseGuards(JwtAuthGuard, AdminGuard)`** en el controller. Las dos rutas `POST`
viven en un controller separado (`AdminWhatsAppDevController`) que solo se registra cuando
`NODE_ENV !== 'production'`, y además cada handler valida `isWhatsAppDevMode()` en runtime; ambas
capas devuelven 404, nunca 403, cuando el modo dev está apagado.

---

### 1.4 Endpoints de Webhooks (`/webhooks`)

**Autenticación especial:** No usan JWT, sino validación específica del proveedor.

#### Twilio Webhooks (`/webhooks/twilio`)

| Endpoint | Método | Descripción | Autenticación |
|----------|--------|-------------|---------------|
| `/api/webhooks/twilio` | `POST` | Recibir webhooks de Twilio | `TwilioWebhookGuard` (valida firma Twilio) |

**Características:**
- ✅ **No requiere JWT** - usa validación de firma de Twilio
- ✅ **Rate limiting** - `TwilioRateLimitGuard`
- ✅ **Idempotencia** - maneja duplicados internamente
- ✅ **Siempre retorna 200** - incluso si hay errores (para evitar retries infinitos de Twilio)

**Tipos de webhooks manejados:**
1. **Status Updates**: Actualización de estado de mensajes (`MessageStatus`)
2. **Inbound Messages**: Mensajes entrantes desde WhatsApp - si no matchean ningún follow-up
   automático pendiente/reciente y `SUPPORT_CONVERSATIONS_ENABLED=true`, se enrutan al contexto
   `support` en vez de descartarse (ver `docs/guides/whatsapp/README.md`)

---

## 2. Tipos de Autenticación

### 2.1 Sin Autenticación (Público)

**Decorador:** `@Public()`

```typescript
@Public()
@Get()
async search() { ... }
```

**Guards aplicados:** Ninguno (el `JwtAuthGuard` verifica el decorador y permite acceso)

---

### 2.2 Autenticación JWT (Usuario)

**Guard:** `JwtAuthGuard`

**Header requerido:**
```
Authorization: Bearer <token>
```

**Cómo funciona:**
1. El token JWT se valida usando la estrategia `JwtStrategy`
2. El payload del token se decodifica y se inyecta como `UserEntity` en `@CurrentUser()`
3. El token contiene: `userId`, `email`, `isAdmin`, etc.

**Aplicación:**
- Por defecto, todos los endpoints están protegidos con `JwtAuthGuard` (a nivel global o controller)
- Los endpoints públicos usan `@Public()` para bypass

---

### 2.3 Autenticación Admin

**Guards:** `JwtAuthGuard` + `AdminGuard`

**Requisitos:**
- ✅ Token JWT válido
- ✅ `isAdmin: true` en el payload del token

**Cómo funciona:**
1. `JwtAuthGuard` valida el token y extrae el usuario
2. `AdminGuard` verifica que `user.isAdminUser()` retorne `true`
3. Si no es admin, retorna `403 Forbidden`

**Ejemplo:**
```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController { ... }
```

---

### 2.4 Autenticación de Roles Específicos

**Guard:** `RolesGuard` (actualmente solo ADMIN)

**Decorador:** `@Roles(UserRole.ADMIN)`

**Nota:** Actualmente solo se usa para ADMIN, pero está preparado para múltiples roles.

---

### 2.5 Autenticación de Perfil Profesional

**Guard:** `ProfessionalGuard`

**Requisitos:**
- ✅ Token JWT válido
- ✅ Usuario debe tener perfil profesional activo (`user.isProfessional()`)

**Uso:** Endpoints que requieren que el usuario sea profesional (ej: `/requests/available`)

---

### 2.6 Autenticación de Webhooks (Twilio)

**Guard:** `TwilioWebhookGuard`

**Cómo funciona:**
1. Valida la firma de Twilio usando `X-Twilio-Signature` header
2. Compara el hash esperado con el recibido
3. No requiere JWT - es autenticación basada en secret compartido

**Ejemplo:**
```typescript
@Controller('webhooks/twilio')
@UseGuards(TwilioWebhookGuard, TwilioRateLimitGuard)
export class TwilioWebhookController { ... }
```

---

## 3. Clientes y Contextos

### 3.1 Cliente: Frontend Principal (`specialist-fe`)

**Tecnología:** Next.js 15 + React 18 + TypeScript

**Endpoints utilizados:**

| Contexto | Endpoints Usados |
|----------|------------------|
| **Auth** | `/auth/register`, `/auth/login`, `/auth/google`, `/auth/facebook` |
| **Users** | `/users/me` (GET, PATCH) |
| **Profiles** | `/professionals/*`, `/companies/*`, `/trades/*` |
| **Requests** | `/requests/*` (todos los endpoints) |
| **Reviews** | `/reviews/*` |
| **Notifications** | `/notifications/*` |
| **Storage** | `/storage/upload`, `/storage/public/*` |
| **Contact** | `/contact/*` |

**Características:**
- ✅ Usa **múltiples contextos** - es el cliente principal que consume casi todos los contextos
- ✅ Autenticación JWT almacenada en `localStorage` o cookies
- ✅ Maneja roles: Cliente, Profesional, Empresa
- ✅ No usa endpoints de Admin ni Webhooks

---

### 3.2 Cliente: Admin Portal (`specialist-admin`)

**Tecnología:** Next.js 16 + React 19 + TypeScript

**Endpoints utilizados:**

| Contexto | Endpoints Usados |
|----------|------------------|
| **Auth** | `/auth/login` (solo login, no registro) |
| **Admin** | `/admin/*` (todos los endpoints) |

**Características:**
- ✅ **Solo usa contexto Admin** - no accede a otros contextos directamente
- ✅ Autenticación JWT con rol Admin requerido
- ✅ Token almacenado en `localStorage`
- ✅ No usa endpoints de usuario normal, webhooks, ni storage público

---

### 3.3 Cliente: Twilio (Webhooks)

**Tipo:** Servicio externo (no es una aplicación frontend)

**Endpoints utilizados:**

| Contexto | Endpoints Usados |
|----------|------------------|
| **Webhooks** | `/webhooks/twilio` (POST) |

**Características:**
- ✅ **Solo webhooks** - no usa ningún otro contexto
- ✅ Autenticación mediante firma de Twilio (no JWT)
- ✅ Envía webhooks cuando:
  - Cambia el estado de un mensaje WhatsApp
  - Llega un mensaje entrante a WhatsApp

---

### 3.4 Cliente: Postman / API Testing

**Tipo:** Herramienta de testing

**Endpoints utilizados:** Todos (según la colección de Postman)

**Características:**
- ✅ Usa **todos los contextos** para testing
- ✅ Maneja autenticación JWT manualmente
- ✅ Puede simular diferentes roles (cliente, profesional, admin)

---

## 4. Guards y Decoradores

### 4.1 Guards Disponibles

| Guard | Propósito | Requisitos |
|-------|-----------|------------|
| `JwtAuthGuard` | Validar token JWT | Token válido en header |
| `AdminGuard` | Verificar rol admin | `isAdmin: true` en token |
| `ProfessionalGuard` | Verificar perfil profesional | Usuario con perfil profesional activo |
| `RolesGuard` | Verificar roles específicos | Rol requerido en token |
| `TwilioWebhookGuard` | Validar firma de Twilio | Firma válida en header |
| `TwilioRateLimitGuard` | Rate limiting para webhooks | - |
| `FileAccessGuard` | Controlar acceso a archivos | Permisos según tipo de archivo |

### 4.2 Decoradores Disponibles

| Decorador | Propósito | Uso |
|-----------|-----------|-----|
| `@Public()` | Marcar endpoint como público | Bypass de `JwtAuthGuard` |
| `@CurrentUser()` | Inyectar usuario actual | Obtener `UserEntity` del token |
| `@Roles(...)` | Especificar roles requeridos | Usar con `RolesGuard` |

---

## 5. Resumen Visual

```
┌─────────────────────────────────────────────────────────────┐
│                    ESTRUCTURA DE LA API                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ENDPOINTS PÚBLICOS (@Public)                                │
│  - /auth/register, /auth/login                              │
│  - /professionals (search), /professionals/:id              │
│  - /companies (search), /companies/:id                      │
│  - /trades                                                   │
│  - /storage/public/*                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ENDPOINTS DE USUARIO (JWT Auth)                             │
│  Guard: JwtAuthGuard                                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ /users/me                                          │     │
│  │ /professionals/me/*                                │     │
│  │ /companies/me/*                                   │     │
│  │ /requests/*                                        │     │
│  │ /reviews/*                                         │     │
│  │ /notifications/*                                   │     │
│  │ /storage/upload, /storage/private/*                │     │
│  │ /contact/*                                        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  Guards adicionales según endpoint:                          │
│  - ProfessionalGuard: /requests/available                  │
│  - FileAccessGuard: /storage/private/*                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ENDPOINTS DE ADMIN                                          │
│  Guards: JwtAuthGuard + AdminGuard                          │
│                                                               │
│  - /admin/users/*                                           │
│  - /admin/professionals/*                                   │
│  - /admin/requests/*                                        │
│  - /admin/notifications/*                                   │
│  - /admin/whatsapp/*                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  WEBHOOKS                                                    │
│  Guard: TwilioWebhookGuard + TwilioRateLimitGuard           │
│                                                               │
│  - /webhooks/twilio (POST)                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  CLIENTES                                                    │
│                                                               │
│  specialist-fe:                                             │
│  ├── Auth, Users, Profiles, Requests, Reviews,              │
│  │    Notifications, Storage, Contact                      │
│  └── NO Admin, NO Webhooks                                  │
│                                                               │
│  specialist-admin:                                          │
│  ├── Auth (solo login)                                     │
│  └── Admin (todos los endpoints)                           │
│                                                               │
│  Twilio:                                                     │
│  └── Webhooks (solo /webhooks/twilio)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Notas Importantes

### 6.1 Prefijo Global

Todos los endpoints tienen el prefijo `/api` configurado globalmente en `main.ts`:

```typescript
app.setGlobalPrefix('api');
```

Por lo tanto, un endpoint definido como `/users/me` en el controller se accede como `/api/users/me`.

### 6.2 Orden de Guards

Los guards se ejecutan en el orden especificado:

```typescript
@UseGuards(JwtAuthGuard, AdminGuard)  // Primero JWT, luego Admin
```

### 6.3 Validación de Permisos

Además de los guards, muchos servicios implementan validación adicional de permisos a nivel de dominio usando `UserEntity.can*()` methods.

### 6.4 CORS

CORS está configurado para permitir:
- `http://localhost:3000` (frontend principal)
- `http://localhost:3001` (frontend admin)
- Orígenes configurados en `CORS_ORIGINS` env var

---

**Última actualización:** Febrero 2026  
**Versión API:** 1.0.0

