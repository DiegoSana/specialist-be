# 🔧 Tareas Pendientes - Specialist Backend

> Última actualización: 2026-01-06

---

## 📋 Resumen de Estado

| Módulo | Permisos | Tests | Documentado |
|--------|----------|-------|-------------|
| Requests | ✅ | ✅ | ⬜ |
| Request Interest | ✅ | ✅ | ⬜ |
| Reviews | ⬜ | ✅ | ⬜ |
| Notifications | ⬜ | ✅ | ⬜ |
| Profiles | ⬜ | ✅ | ⬜ |
| Identity | ⬜ | ✅ | ⬜ |

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

### ⬜ Pendiente

- [ ] **Reviews Module**
  - [ ] Crear `ReviewAuthContext` o reutilizar patrón
  - [ ] Agregar `canBeModeratedBy(ctx)` a `ReviewEntity`
  - [ ] Agregar `canBeViewedBy(ctx)` para reviews pendientes
  - [ ] Refactorizar `ReviewService`
  - [ ] Actualizar `ReviewsController`

- [ ] **Notifications Module**
  - [ ] Verificar que usuarios solo vean sus notificaciones
  - [ ] Agregar permisos de admin para ver/gestionar notificaciones
  - [ ] Revisar `markAsRead` y `markAllAsRead`

- [ ] **Profiles Module**
  - [ ] Verificar permisos en `ProfessionalService`
  - [ ] Verificar permisos en `ClientService`
  - [ ] ¿Quién puede ver perfiles de otros usuarios?
  - [ ] ¿Quién puede editar perfiles?

- [ ] **Identity Module**
  - [ ] Revisar permisos de admin para gestión de usuarios
  - [ ] Verificar endpoints de cambio de estado de usuario

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

## 📝 Pull Requests Pendientes

| PR | Repo | Estado | Descripción |
|----|------|--------|-------------|
| #10 | BE | 🟡 Pendiente merge | feat: Request title + notificaciones mejoradas |
| #3 | FE | 🟡 Pendiente merge | fix: Campanita mobile responsive |
| - | BE | 🔴 Por crear | refactor: Permisos unificados en Requests |
| - | FE | 🔴 Por crear | fix: Remover Accept Quote + role param |

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

- [ ] Documentar patrón de autorización `AuthContext` + métodos de dominio
- [ ] Actualizar README con nuevos endpoints
- [ ] Documentar flujos de permisos por rol (Cliente, Especialista, Admin)
- [ ] Agregar diagramas de estado de Request

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
1. Crear PRs pendientes
2. Merge de PRs existentes
3. Revisar módulo de Reviews (permisos de moderación)

### Próxima Semana
1. Refactorizar Notifications module
2. Revisar Profiles module
3. Tests de integración

### Mes
1. Documentación completa
2. Tests E2E
3. Mejoras de performance

---

## 📌 Notas

- El patrón de `AuthContext` puede ser extraído a un módulo compartido
- Considerar crear un guard de NestJS genérico para permisos comunes
- Los métodos `canXxxBy()` en entidades siguen el principio de "tell, don't ask"

