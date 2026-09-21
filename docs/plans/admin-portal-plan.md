# Plan de Implementación: Portal de Administración

**Fecha de creación**: Enero 2026  
**Estado**: Planificación  
**Bounded Context**: Admin (cross-cutting con todos los módulos)

---

## 1. Objetivo del Sistema

### Problema que resuelve

Actualmente, las operaciones administrativas se realizan principalmente a través de:
- Endpoints REST directos (`/admin/*`)
- Scripts manuales
- Acceso directo a la base de datos

Esto limita:
- La eficiencia de los administradores
- La visibilidad del estado general del sistema
- La capacidad de tomar decisiones basadas en datos
- La auditoría de acciones administrativas

### Scope del sistema

**Incluye:**
- Dashboard con métricas y KPIs del sistema
- Gestión de usuarios (visualización, edición, cambio de estado)
- Gestión de solicitudes (visualización, moderación, asignación manual)
- Gestión de perfiles profesionales y empresas (verificación, suspensión)
- Moderación de reviews pendientes
- Gestión de notificaciones (estadísticas, reenviar fallidas)
- Logs de auditoría de acciones administrativas

**NO incluye (por ahora):**
- Sistema de roles avanzados (multi-admin, permisos granulares)
- Reportes avanzados y exportación de datos
- Integración con herramientas externas de analytics
- Sistema de tickets de soporte completo
- Configuración avanzada del sistema

---

## 2. Arquitectura del Sistema

### 2.1 Decisión Arquitectónica: Repos Separados + Paquete Shared

**Decisión:** Crear una aplicación admin en un **repo separado**, compartiendo código a través de un paquete `shared` publicado en GitHub (no npm).

**Beneficios:**
- ✅ **Separación clara** de responsabilidades (repos independientes)
- ✅ **Sin duplicación** de código gracias al paquete `shared`
- ✅ **Tipos compartidos** entre backend y frontends
- ✅ **Deploy independiente** de cada aplicación
- ✅ **Permisos granulares** por repo
- ✅ **Cursor entiende todo** si los repos están en la misma carpeta padre
- ✅ **Gratis** - no requiere npm privado
- ✅ **Flexible** - cada repo puede evolucionar independientemente

### 2.2 Estructura de Repos

```
/var/www/specialist/                    # Carpeta padre (opcional, para Cursor)
│
├ specialist-web/                      # Repo separado (frontend principal)
│   ├ app/
│   ├ components/
│   ├ package.json                     # Depende de @specialist/shared
│   └ ...
│
├ specialist-admin/                    # Repo separado (nuevo - admin panel)
│   ├ app/
│   ├ components/
│   ├ package.json                     # Depende de @specialist/shared
│   └ ...
│
├ specialist-be/                      # Repo separado (backend NestJS)
│   ├ src/
│   ├ package.json                     # Depende de @specialist/shared
│   └ ...
│
└ specialist-shared/                   # Repo separado (paquete compartido)
    ├ src/
    │   ├ types/
    │   ├ schemas/
    │   ├ constants/
    │   └ index.ts
    ├ package.json
    ├ tsconfig.json
    └ dist/                            # Build output
```

**Cada repo es independiente:**
- Tiene su propio `.git/`
- Puede tener diferentes permisos
- Puede deployarse por separado
- Puede tener su propio CI/CD

### 2.3 Stack Tecnológico

**Stack del Admin Panel (igual al frontend principal):**

- **Framework:** Next.js 16+ (App Router)
- **React:** React 19+
- **TypeScript:** 5.3+
- **Styling:** Tailwind CSS 3.4+
- **State Management:** @tanstack/react-query 5.17+
- **HTTP Client:** Axios 1.6+
- **i18n:** next-intl 4.6+ (opcional para admin)
- **Testing:** Jest + React Testing Library
- **UI Components:** Shadcn UI (sobre Tailwind CSS)

**Stack del Paquete Shared:**

- **TypeScript:** Para tipos y contratos
- **Zod:** Para schemas de validación
- **Build:** TypeScript compiler (tsc)

**Gestión de Dependencias:**

- **GitHub:** Repositorio para `specialist-shared` (público o privado)
- **Git Dependencies:** Instalación directa desde GitHub (no requiere npm registry)
- **npm/pnpm:** Package managers estándar en cada repo

### 2.4 Paquete Shared - Contenido

El repo `specialist-shared` contendrá:

```
specialist-shared/
├ src/
│   ├ types/                # Tipos TypeScript compartidos
│   │   ├ user.ts
│   │   ├ request.ts
│   │   ├ admin.ts
│   │   └ index.ts
│   │
│   ├ dto/                   # Data Transfer Objects
│   │   ├ auth.dto.ts
│   │   ├ user.dto.ts
│   │   └ index.ts
│   │
│   ├ schemas/               # Schemas Zod para validación
│   │   ├ auth.schema.ts
│   │   ├ user.schema.ts
│   │   └ index.ts
│   │
│   ├ constants/            # Constantes compartidas
│   │   ├ roles.ts
│   │   ├ request-status.ts
│   │   └ index.ts
│   │
│   ├ contracts/            # Contratos API (opcional, futuro OpenAPI)
│   │   ├ auth.contract.ts
│   │   └ index.ts
│   │
│   └ index.ts              # Barrel export
├ dist/                      # Build output (generado)
├ package.json
├ tsconfig.json
└ README.md
```

**Ejemplo de uso:**

```typescript
// En specialist-admin o specialist-be
import { User, LoginDTO, loginSchema, UserRole } from '@specialist/shared'
```

**Instalación en cada repo:**

```json
// package.json en specialist-admin, specialist-be, specialist-web
{
  "dependencies": {
    "@specialist/shared": "github:tu-usuario/specialist-shared#main"
  }
}
```

### 2.5 UI Framework / Component Library

**Decisión:** **Shadcn UI** sobre Tailwind CSS

**Justificación:**
- ✅ Compatible con Tailwind CSS existente
- ✅ Componentes accesibles (basados en Radix UI)
- ✅ Copy-paste de componentes (no es una dependencia npm)
- ✅ Muy customizable
- ✅ Puede coexistir con componentes custom
- ✅ Acelera desarrollo sin sacrificar control

**Estructura propuesta:**

```
specialist-admin/
  components/
    ui/              # Componentes de Shadcn UI
      button.tsx
      table.tsx
      dialog.tsx
      card.tsx
      ...
    admin/           # Componentes específicos del admin
      user-table.tsx
      request-card.tsx
      dashboard-stats.tsx
      ...
```

### 2.6 Autenticación y Autorización

**Sistema de autenticación:**

- **Mismo sistema que frontend principal:** JWT tokens
- **Almacenamiento:** localStorage (o cookies httpOnly en futuro)
- **Validación:** Backend valida token y rol ADMIN en cada request

**Implementación en Admin:**

1. **Hook `use-admin-auth` (en shared o admin):**
   ```typescript
   // Verificar autenticación y rol admin
   // Hacer request a /api/admin/me para validar permisos
   // Cachear resultado con React Query
   ```

2. **Componente `AdminLayout`:**
   ```typescript
   // Verificar autenticación
   // Verificar rol ADMIN
   // Redirigir a /admin/login si no está autenticado
   // Redirigir a /dashboard si no es admin
   ```

3. **Middleware de Next.js (opcional):**
   ```typescript
   // Proteger todas las rutas /admin/* automáticamente
   ```

**Estado actual del backend:**
- Ya existe `AdminService` y `AdminController`
- Ya existe validación de permisos admin en servicios
- Endpoints admin requieren autenticación y validación de rol admin
- Falta verificar cómo se incluye el `role` en el JWT token

---

## 3. Funcionalidades Básicas para MVP

### 3.1 Dashboard Principal

**Métricas a mostrar:**

- **Usuarios:**
  - Total de usuarios registrados
  - Nuevos usuarios (últimos 7/30 días)
  - Usuarios activos (últimos 30 días)
  - Distribución por rol (Client, Professional, Company)

- **Solicitudes:**
  - Total de solicitudes
  - Solicitudes por estado (los 15 `RequestStatus`: DRAFT, PUBLISHED, SENT, CONTACT_RELEASED, IN_PROGRESS, FINISHED, CLOSED, UNDER_REVIEW, ...)
  - Solicitudes creadas (últimos 7/30 días)
  - Tiempo promedio de respuesta
  - Tasa de aceptación

- **Perfiles de Proveedores:**
  - Total de profesionales activos
  - Total de empresas activas
  - Perfiles pendientes de verificación
  - Perfiles suspendidos

- **Reviews:**
  - Total de reviews
  - Reviews pendientes de moderación
  - Rating promedio del sistema

- **Notificaciones:**
  - Total de notificaciones enviadas (últimos 7 días)
  - Tasa de entrega exitosa
  - Notificaciones fallidas pendientes de reenvío

**Visualizaciones:**
- Gráficos de líneas para tendencias temporales
- Gráficos de barras para distribución por categorías
- Cards con números principales
- Tabla de actividad reciente

### 3.2 Gestión de Usuarios

**Funcionalidades:**

- **Listar usuarios:**
  - Tabla con paginación
  - Filtros: rol, estado, fecha de registro
  - Búsqueda por nombre, email, teléfono
  - Ordenamiento por columnas

- **Ver detalle de usuario:**
  - Información básica (nombre, email, teléfono, rol)
  - Estado de verificación (email, teléfono)
  - Perfiles asociados (Professional, Company, Client)
  - Historial de solicitudes
  - Historial de reviews

- **Editar usuario:**
  - Cambiar nombre, email, teléfono
  - Cambiar rol (con validaciones)
  - Cambiar estado (ACTIVE, INACTIVE, SUSPENDED)

- **Acciones administrativas:**
  - Suspender usuario
  - Activar usuario
  - Marcar email/teléfono como verificado manualmente

### 3.3 Gestión de Solicitudes

**Funcionalidades:**

- **Listar solicitudes:**
  - Tabla con paginación
  - Filtros: estado, cliente, proveedor, fecha
  - Búsqueda por título, ID
  - Ordenamiento por columnas

- **Ver detalle de solicitud:**
  - Información completa de la solicitud
  - Cliente y proveedor asignado
  - Historial de cambios de estado
  - Fotos asociadas
  - Reviews relacionadas
  - Interacciones de WhatsApp (si aplica)

- **Acciones administrativas:**
  - Cambiar estado manualmente (con validaciones)
  - Asignar proveedor manualmente
  - Ver/descargar fotos
  - Ver historial completo

### 3.4 Gestión de Perfiles de Proveedores

**Funcionalidades:**

#### Profesionales:

- **Listar profesionales:**
  - Tabla con paginación
  - Filtros: estado, verificación, oficios
  - Búsqueda por nombre, email
  - Ordenamiento por columnas

- **Ver detalle:**
  - Información completa del perfil
  - Galería de fotos
  - Reviews recibidas
  - Solicitudes completadas
  - Rating y estadísticas

- **Acciones administrativas:**
  - Verificar perfil profesional
  - Suspender perfil
  - Activar perfil
  - Rechazar perfil (con motivo)

#### Empresas:

- **Listar empresas:**
  - Tabla con paginación
  - Filtros: estado, verificación, CUIT
  - Búsqueda por nombre, CUIT
  - Ordenamiento por columnas

- **Ver detalle:**
  - Información completa de la empresa
  - Datos legales (CUIT, razón social)
  - Galería de fotos
  - Reviews recibidas
  - Solicitudes completadas
  - Rating y estadísticas

- **Acciones administrativas:**
  - Verificar empresa
  - Suspender empresa
  - Activar empresa
  - Rechazar empresa (con motivo)

### 3.5 Moderación de Reviews

**Funcionalidades:**

- **Listar reviews pendientes:**
  - Tabla con paginación
  - Filtro por estado (PENDING, APPROVED, REJECTED)
  - Ordenamiento por fecha

- **Ver detalle de review:**
  - Contenido completo del review
  - Información del solicitante
  - Información del proveedor
  - Solicitud relacionada
  - Fecha de creación

- **Acciones de moderación:**
  - Aprobar review
  - Rechazar review (con motivo)
  - Editar contenido (si es necesario)

### 3.6 Gestión de Notificaciones

**Funcionalidades:**

- **Estadísticas de notificaciones:**
  - Total enviadas (últimos 7/30 días)
  - Tasa de entrega exitosa
  - Notificaciones por canal (EMAIL, WHATSAPP)
  - Notificaciones por tipo

- **Listar notificaciones fallidas:**
  - Tabla con paginación
  - Filtros: estado, canal, tipo
  - Información de error

- **Acciones:**
  - Reenviar notificación fallida
  - Ver detalles de entrega
  - Ver logs de intentos

### 3.7 Logs de Auditoría (Futuro, pero planificar estructura)

**Funcionalidades futuras:**

- Registro de todas las acciones administrativas
- Filtros por usuario, acción, fecha
- Exportación de logs
- Alertas por acciones críticas

---

## 4. Setup de Repos Separados

### 4.1 Crear Repo Shared

**Paso 1: Crear nuevo repo en GitHub**

```bash
# En GitHub: crear repo "specialist-shared" (público o privado)
```

**Paso 2: Clonar y configurar**

```bash
git clone https://github.com/tu-usuario/specialist-shared.git
cd specialist-shared
```

**Paso 3: Inicializar proyecto**

```bash
npm init -y
# o
pnpm init
```

**Paso 4: Configurar package.json**

`specialist-shared/package.json`:
```json
{
  "name": "@specialist/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  },
  "files": [
    "dist",
    "src"
  ]
}
```

**Paso 5: Configurar TypeScript**

`specialist-shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src"]
}
```

**Paso 6: Crear estructura inicial**

```bash
mkdir -p src/{types,schemas,constants,contracts}
```

**Estructura:**
```
specialist-shared/
├ src/
│   ├ types/
│   │   ├ user.ts
│   │   ├ request.ts
│   │   └ index.ts
│   ├ schemas/
│   │   ├ auth.schema.ts
│   │   └ index.ts
│   ├ constants/
│   │   ├ roles.ts
│   │   └ index.ts
│   ├ contracts/
│   │   └ admin.contract.ts
│   └ index.ts
├ package.json
├ tsconfig.json
├ .gitignore
└ README.md
```

**Ejemplo: `src/types/user.ts`**
```typescript
export interface User {
  id: string
  email: string
  name: string
  role: 'USER' | 'ADMIN' | 'PROFESSIONAL' | 'COMPANY'
  createdAt: string
  updatedAt: string
}
```

**Ejemplo: `src/schemas/auth.schema.ts`**
```typescript
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type LoginDTO = z.infer<typeof loginSchema>
```

**Ejemplo: `src/constants/roles.ts`**
```typescript
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  PROFESSIONAL = 'PROFESSIONAL',
  COMPANY = 'COMPANY',
}
```

**Ejemplo: `src/index.ts` (barrel export)**
```typescript
export * from './types'
export * from './schemas'
export * from './constants'
```

**Paso 7: Build y commit inicial**

```bash
npm run build
git add .
git commit -m "Initial commit: shared types and schemas"
git push origin main
```

### 4.2 Crear Repo Admin

**Paso 1: Crear nuevo repo en GitHub**

```bash
# En GitHub: crear repo "specialist-admin"
```

**Paso 2: Crear app Next.js**

```bash
git clone https://github.com/tu-usuario/specialist-admin.git
cd specialist-admin
npx create-next-app@latest . --ts --tailwind --app --no-src-dir
```

**Paso 3: Instalar dependencias**

```bash
npm install @tanstack/react-query axios
npm install -D @types/node
```

**Paso 4: Agregar dependencia de shared**

`specialist-admin/package.json`:
```json
{
  "dependencies": {
    "@specialist/shared": "github:tu-usuario/specialist-shared#main",
    "@tanstack/react-query": "^5.17.0",
    "axios": "^1.6.2"
  }
}
```

**Paso 5: Instalar dependencias**

```bash
npm install
# Esto descargará @specialist/shared desde GitHub
```

**Paso 6: Configurar Shadcn UI**

```bash
npx shadcn@latest init
```

**Paso 7: Verificar importación**

```typescript
// app/test/page.tsx (temporal, para probar)
import { User, loginSchema } from '@specialist/shared'

export default function TestPage() {
  return <div>Shared package works!</div>
}
```

### 4.3 Conectar Backend (specialist-be) con Shared

**Paso 1: Agregar dependencia en backend**

`specialist-be/package.json`:
```json
{
  "dependencies": {
    "@specialist/shared": "github:tu-usuario/specialist-shared#main"
  }
}
```

**Paso 2: Instalar**

```bash
cd specialist-be
npm install
```

**Paso 3: Usar en código**

```typescript
// src/admin/admin.controller.ts
import { LoginDTO, loginSchema } from '@specialist/shared'

@Post('/login')
async login(@Body() body: LoginDTO) {
  const validated = loginSchema.parse(body)
  // ...
}
```

### 4.4 Workflow de Desarrollo

**Cuando cambias `specialist-shared`:**

```bash
cd specialist-shared
# Hacer cambios en src/
npm run build
git add .
git commit -m "Add phone field to User"
git push origin main
```

**Para usar cambios en otros repos:**

```bash
# En specialist-admin o specialist-be
npm install @specialist/shared
# Esto actualizará desde GitHub
```

**Para usar versión específica (tags):**

```bash
# En specialist-shared
git tag v1.0.0
git push origin v1.0.0

# En otros repos, actualizar package.json:
{
  "@specialist/shared": "github:tu-usuario/specialist-shared#v1.0.0"
}
```

### 4.5 Configurar Cursor AI (Opcional)

Si todos los repos están en la misma carpeta padre, Cursor puede ver el contexto:

```
/var/www/specialist/
  ├ specialist-web/
  ├ specialist-admin/
  ├ specialist-be/
  └ specialist-shared/
```

Puedes crear `.cursor/rules.md` en la carpeta padre:

```markdown
# Specialist Platform - Multi-Repo Rules

You are working with multiple separate repositories:

- `specialist-be` = NestJS backend
- `specialist-admin` = Next.js admin panel
- `specialist-web` = Next.js frontend principal
- `specialist-shared` = shared types, schemas, and constants

## Rules:

1. **Never duplicate types** - always use `@specialist/shared`
2. **Use Zod schemas** from shared for validation
3. **Follow existing folder structure** in each repo
4. **Type safety first** - use TypeScript strictly
5. **Shared is installed from GitHub** - use `github:user/repo#branch` syntax
```

---

## 5. Estructura de Rutas del Admin

### 5.1 Rutas Principales

```
specialist-admin/app/
  (auth)/
    login/
      page.tsx
  (admin)/
    layout.tsx          # AdminLayout con protección
    dashboard/
      page.tsx
    users/
      page.tsx          # Lista de usuarios
      [id]/
        page.tsx        # Detalle de usuario
    requests/
      page.tsx          # Lista de solicitudes
      [id]/
        page.tsx        # Detalle de solicitud
    professionals/
      page.tsx
      [id]/
        page.tsx
    companies/
      page.tsx
      [id]/
        page.tsx
    reviews/
      page.tsx          # Reviews pendientes
      [id]/
        page.tsx
    notifications/
      page.tsx
```

### 5.2 Integración con Backend

**Endpoints existentes a utilizar:**

- `GET /admin/users` - Listar usuarios
- `GET /admin/users/:id` - Ver usuario
- `PATCH /admin/users/:id/status` - Cambiar estado
- `GET /admin/notifications` - Listar notificaciones
- `POST /admin/notifications/:id/resend` - Reenviar notificación
- `GET /admin/notifications/stats` - Estadísticas

**Endpoints creados:**

- ✅ `GET /admin/requests` - Listar todas las solicitudes (con paginación y filtro por status)

**Endpoints a crear:**

- ⏳ `GET /admin/dashboard/stats` - Métricas del dashboard (actualmente se calculan en frontend)
- ✅ `GET /admin/requests` - Listar todas las solicitudes
- ✅ `GET /admin/professionals` - Listar todos los profesionales (existe)
- ⏳ `GET /admin/companies` - Listar todas las empresas
- ⏳ `GET /admin/reviews/pending` - Listar reviews pendientes
- ⏳ `POST /admin/reviews/:id/approve` - Aprobar review
- ⏳ `POST /admin/reviews/:id/reject` - Rechazar review

**Contratos API en shared:**

```typescript
// specialist-shared/src/contracts/admin.contract.ts
export const AdminContract = {
  dashboard: {
    stats: {
      method: 'GET',
      path: '/admin/dashboard/stats',
    },
  },
  users: {
    list: {
      method: 'GET',
      path: '/admin/users',
    },
    get: {
      method: 'GET',
      path: '/admin/users/:id',
    },
  },
  // ...
}
```

### 5.3 Autenticación y Autorización

**Flujo propuesto:**

1. Login en `/admin/login` (separado del login principal)
2. Validar que el usuario tiene rol `ADMIN`
3. Generar JWT con claim `role: ADMIN`
4. Guardar token en localStorage (o cookie httpOnly en futuro)
5. `AdminLayout` protege todas las rutas `/admin/*`
6. Backend valida token y rol en cada request

**Implementación:**

- `AdminLayout` en `specialist-admin/app/(admin)/layout.tsx`
- Hook `use-admin-auth` usando React Query
- Tipos y schemas importados desde `@specialist/shared`

---

## 6. Fases de Implementación

### Fase 0: Setup de Repos y Shared (Semana 0)

**Tareas:**

- [ ] Crear repo `specialist-shared` en GitHub
- [ ] Configurar `specialist-shared` con TypeScript y estructura base
- [ ] Migrar tipos básicos al shared (User, Request, etc.)
- [ ] Crear schemas Zod básicos (auth, user)
- [ ] Build y commit inicial de `specialist-shared`
- [ ] Crear repo `specialist-admin` en GitHub
- [ ] Crear app Next.js admin con Tailwind
- [ ] Instalar y configurar Shadcn UI
- [ ] Conectar `specialist-admin` con `specialist-shared` (GitHub dependency)
- [ ] Conectar `specialist-be` con `specialist-shared` (GitHub dependency)
- [ ] Verificar que las importaciones funcionan en ambos repos
- [ ] Configurar `.cursor/rules.md` (opcional, si repos están en misma carpeta)

**Entregables:**
- Repo `specialist-shared` funcionando y publicado en GitHub
- Repo `specialist-admin` creado y conectado a shared
- Backend conectado a shared
- Imports funcionando correctamente

**Comandos clave:**
```bash
# Desarrollo de shared
cd specialist-shared
npm run build          # Build shared
npm run dev           # Watch mode

# Desarrollo de admin
cd specialist-admin
npm run dev           # Dev server

# Actualizar shared en otros repos
cd specialist-admin
npm install @specialist/shared  # Actualiza desde GitHub
```

### Fase 1: Autenticación y Layout Base (Semana 1)

**Tareas:**

- [ ] Crear tipos de auth en shared (`LoginDTO`, `AuthResponse`)
- [ ] Crear schemas Zod para login
- [ ] Implementar login page en admin
- [ ] Crear hook `use-admin-auth` usando React Query
- [ ] Crear `AdminLayout` con protección de rutas
- [ ] Implementar sidebar y header base
- [ ] Configurar integración con API backend (`/admin/auth/login`)
- [ ] Implementar logout
- [ ] Agregar manejo de errores de autenticación

**Entregables:**
- Login funcional con validación
- Layout base con sidebar y header
- Protección de rutas implementada
- Conexión con backend establecida

### Fase 2: Dashboard y Gestión de Usuarios (Semana 2)

**Tareas:**

- [ ] Crear tipos en shared para dashboard stats y usuarios
- [ ] Crear endpoint `/admin/dashboard/stats` en backend
- [ ] Implementar dashboard con métricas principales (usando Shadcn UI cards)
- [ ] Crear componente `UserTable` con Shadcn UI Table
- [ ] Implementar listado de usuarios con filtros y paginación
- [ ] Implementar detalle de usuario (modal o página)
- [ ] Implementar edición de usuario
- [ ] Implementar cambio de estado de usuario
- [ ] Agregar loading states y manejo de errores

**Entregables:**
- Dashboard funcional con métricas
- CRUD completo de usuarios
- Componentes reutilizables con Shadcn UI

### Fase 3: Gestión de Solicitudes y Perfiles (Semana 3)

**Tareas:**

- [ ] Agregar tipos de Request, Professional, Company en shared
- [ ] Crear endpoints faltantes en backend
- [ ] Crear componentes reutilizables (tables, cards) en shared o admin
- [ ] Implementar listado de solicitudes con filtros
- [ ] Implementar detalle de solicitud
- [ ] Implementar acciones administrativas en solicitudes
- [ ] Implementar listado de profesionales
- [ ] Implementar detalle y acciones de profesionales
- [ ] Implementar listado de empresas
- [ ] Implementar detalle y acciones de empresas

**Entregables:**
- Gestión completa de solicitudes
- Gestión completa de perfiles de proveedores
- Tipos compartidos entre frontend y backend

### Fase 4: Moderación y Notificaciones (Semana 4)

**Tareas:**

- [ ] Agregar tipos de Review y Notification en shared
- [ ] Implementar moderación de reviews (listado, aprobar, rechazar)
- [ ] Implementar gestión de notificaciones (estadísticas, listado)
- [ ] Implementar reenvío de notificaciones fallidas
- [ ] Agregar validaciones y manejo de errores
- [ ] Agregar confirmaciones para acciones críticas (usar Shadcn Dialog)
- [ ] Testing end-to-end
- [ ] Documentar uso del admin portal

**Entregables:**
- Sistema completo de moderación
- Gestión de notificaciones funcional
- Documentación de uso

### Fase 5: Polish y Mejoras (Semana 5)

**Tareas:**

- [ ] Mejorar UX/UI basado en feedback
- [ ] Agregar loading states y skeletons (Shadcn Skeleton)
- [ ] Agregar mensajes de éxito/error consistentes (Shadcn Toast)
- [ ] Optimizar performance (paginación, lazy loading, React Query cache)
- [ ] Agregar tests unitarios e integración
- [ ] Refactorizar código duplicado hacia shared
- [ ] Optimizar bundle size
- [ ] Preparar para deploy (variables de entorno, build optimizado)

**Entregables:**
- Admin portal completo y pulido
- Código compartido optimizado
- Listo para producción

---

## 6. Consideraciones Técnicas

### 6.1 Seguridad

- **Autenticación fuerte:** Requerir 2FA para admins (futuro)
- **Rate limiting:** Limitar requests desde admin panel
- **Audit log:** Registrar todas las acciones administrativas
- **Validación:** Validar permisos en backend, nunca confiar solo en frontend
- **HTTPS:** Obligatorio en producción

### 6.2 Performance

- **Paginación:** Todas las listas deben ser paginadas
- **Caché:** Cachear métricas del dashboard (TTL corto)
- **Lazy loading:** Cargar datos bajo demanda
- **Optimización de queries:** Evitar N+1 queries en backend

### 6.3 UX/UI

- **Responsive:** Admin debe funcionar en desktop y tablet
- **Accesibilidad:** Seguir WCAG 2.1 nivel AA
- **Feedback visual:** Loading states, confirmaciones, mensajes claros
- **Navegación intuitiva:** Breadcrumbs, sidebar persistente

### 6.4 Testing

- **Unit tests:** Componentes y servicios
- **Integration tests:** Flujos completos
- **E2E tests:** Flujos críticos administrativos
- **Manual testing:** Checklist de funcionalidades antes de release

---

## 7. Métricas de Éxito

### KPIs a medir:

- **Adopción:**
  - % de acciones administrativas realizadas vía portal vs scripts/API directa
  - Tiempo promedio para completar tareas administrativas comunes

- **Eficiencia:**
  - Reducción en tiempo para moderar reviews
  - Reducción en tiempo para gestionar usuarios
  - Reducción en tiempo para verificar perfiles

- **Calidad:**
  - Errores administrativos (acciones incorrectas)
  - Tiempo de respuesta del sistema
  - Satisfacción de administradores (survey)

---

## 8. Próximos Pasos

### Inmediatos:

1. **Setup de Repos:**
   - Crear repo `specialist-shared` en GitHub (público o privado)
   - Configurar `specialist-shared` con TypeScript y estructura base
   - Migrar tipos básicos (User, Request, etc.) al shared
   - Crear schemas Zod para validación
   - Definir constantes compartidas (roles, estados)
   - Build y push inicial de `specialist-shared`

2. **Crear Repo Admin:**
   - Crear repo `specialist-admin` en GitHub
   - Crear app Next.js con Tailwind y TypeScript
   - Instalar y configurar Shadcn UI
   - Conectar con `specialist-shared` usando GitHub dependency
   - Verificar que los imports funcionan

3. **Conectar Backend:**
   - Agregar dependencia de `specialist-shared` en `specialist-be`
   - Verificar endpoints admin existentes
   - Crear endpoints faltantes (`/admin/dashboard/stats`, etc.)
   - Asegurar que JWT incluye `role` en el payload
   - Documentar endpoints en Swagger

### Corto plazo (Fase 0-1): ✅ COMPLETADO

- ✅ Setup completo de repos separados
- ✅ Paquete shared funcionando (`specialist-shared`)
- ✅ App admin con autenticación (`specialist-admin`)
- ✅ Layout base implementado
- ✅ Dashboard con métricas básicas
- ✅ Gestión de usuarios (listado, detalle, cambio de estado)
- ✅ Gestión de solicitudes (listado, detalle, filtros)
- ✅ Endpoint `/admin/requests` creado en backend

### Mediano plazo (Fase 2-4): 🚧 EN PROGRESO

- ✅ Dashboard con métricas básicas
- ✅ Gestión de usuarios completa
- ✅ Gestión de solicitudes básica
- ⏳ Gestión de profesionales (pendiente)
- ⏳ Gestión de empresas (pendiente)
- ⏳ Moderación de reviews (pendiente)
- ⏳ Gestión de notificaciones (pendiente)
- ⏳ Testing end-to-end (pendiente)

### Largo plazo (Fase 5+):

- Polish y optimizaciones
- Deploy a staging/producción
- Testing con usuarios reales
- Iterar basado en feedback
- Migrar frontend principal al monorepo (si aplica)

---

## 9. Referencias

- [Backend Admin Endpoints](./../API.md#admin-endpoints)
- [Authorization Pattern](./../architecture/AUTHORIZATION_PATTERN.md)
- [Roles Architecture](./../architecture/ROLES_ARCHITECTURE.md)

---

**Última actualización:** Febrero 2026  
**Estado:** Implementación en progreso - Fase 1 y 2 completadas  
**Decisión arquitectónica:** Repos separados + paquete shared desde GitHub ✅ IMPLEMENTADO

### Estado de Implementación:

- ✅ **Stack implementado:** Next.js 16+ (App Router) + React 19+ + TypeScript + Tailwind CSS + Shadcn UI
- ✅ **Arquitectura implementada:** Repos separados (`specialist-admin`, `specialist-be`, `specialist-shared`)
- ✅ **Gestión de dependencias:** Git dependencies desde GitHub funcionando
- ✅ **Repos creados:** `specialist-shared` y `specialist-admin` en GitHub
- ✅ **Fase 1 completada:** Autenticación, layout, protección de rutas
- ✅ **Fase 2 parcialmente completada:** Dashboard, gestión de usuarios, gestión de solicitudes

### Repositorios:

- `specialist-shared`: https://github.com/DiegoSana/specialist-shared
- `specialist-admin`: https://github.com/DiegoSana/specialist-admin (pendiente de crear en GitHub)




