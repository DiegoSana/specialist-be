# Permisos por Rol - Specialist

> Resumen de qué puede hacer cada tipo de usuario en la API. La validación se implementa con el [patrón AuthContext + dominio](../architecture/AUTHORIZATION_PATTERN.md). El concepto **"perfil activo"** (cliente o proveedor) se obtiene desde un único punto de orquestación: [ProfileActivationService](../architecture/PROFILE_ACTIVATION_ORCHESTRATION.md).

---

## Roles y perfiles

| Rol / Perfil | Descripción |
|--------------|-------------|
| **Usuario autenticado** | Cualquier usuario con JWT válido |
| **Cliente** | Usuario con perfil de cliente activo (`hasClientProfile`) |
| **Profesional** | Usuario con perfil profesional (`hasProfessionalProfile`); puede estar activo o inactivo |
| **Empresa** | Usuario con perfil de empresa (`hasCompanyProfile`); puede estar activa o inactiva |
| **Proveedor** | Quien ofrece servicios: **Profesional o Empresa**. Solo uno puede estar “activo” (operando) a la vez. Incluye expresar interés, job board, ser asignado, calificar al cliente. |
| **Admin** | Usuario con `isAdmin: true` |

Un mismo usuario puede ser Cliente y tener además perfil Profesional o Empresa (solo uno activo a la vez). Ver [Company Profiles](./architecture/COMPANY_PROFILES.md).

### Perfiles: activo y verificado

Un perfil **opera** (aparece en catálogo, puede recibir asignaciones) cuando:

- **Professional**: `status` es `ACTIVE` o `VERIFIED` (y usuario con email y teléfono verificados para aparecer en GET /providers).
- **Company**: igual: `status` es `ACTIVE` o `VERIFIED` (y usuario verificado para GET /providers).

**Estados:**

- **Professional**: `PENDING_VERIFICATION` → (en MVP puede auto-activarse y pasar a `ACTIVE`) → `ACTIVE` o `VERIFIED`. `INACTIVE` = el usuario eligió operar con Company.
- **Company**: `PENDING_VERIFICATION` → **solo admin** puede verificar → `ACTIVE` o `VERIFIED`. No se puede auto-activar mientras esté pendiente. `INACTIVE` = el usuario eligió operar con Professional.

**Activar perfil** (`POST /professionals/me/activate` o `POST /companies/me/activate`): elige qué perfil está “operando” (el otro se desactiva). Professional en `PENDING_VERIFICATION` puede activarse en MVP; Company **solo** si ya está `ACTIVE` o `VERIFIED` (verificado por admin).

---

## Cliente

### Puede

- Ver y editar su perfil (`GET/PATCH /users/me`).
- Activar perfil de cliente (`POST /users/me/client-profile`).
- Crear solicitudes (`POST /requests`).
- Ver sus propias solicitudes y las que le asignaron (como proveedor).
- Ver solicitudes públicas disponibles si además es proveedor.
- Editar, agregar/quitar fotos y cambiar estado de **sus** solicitudes (dentro de las reglas de negocio).
- Ver interesados **solo en sus propias solicitudes** (`GET /requests/:id/interests` — el backend valida que sea el dueño del request; si no, 403).
- Asignar un proveedor a una solicitud pública (`POST /requests/:id/assign`).
- Crear, editar y eliminar **su** reseña de un request completado (estado PENDING hasta moderación).
- Ver notificaciones propias y gestionar preferencias.
- Solicitar y confirmar verificación de email y teléfono.
- Subir archivos y acceder a archivos privados propios.

### No puede

- Ver solicitudes de otros clientes (salvo las públicas sin asignar si es proveedor).
- Asignar proveedor en solicitudes que no le pertenecen.
- Moderar reseñas (aprobar/rechazar).
- Acceder a endpoints de admin.
- Ver datos sensibles de otros usuarios (email, teléfono de otros proveedores en listados públicos).

---

## Profesional / Empresa (Proveedor)

### Puede

- Todo lo que puede un usuario autenticado (perfil, notificaciones, verificación, etc.).
- Crear y editar su perfil profesional o de empresa (`/professionals/me` o `/companies/me`).
- Activar perfil profesional o empresa (`POST /professionals/me/activate`, `POST /companies/me/activate`). Ver reglas en [Perfiles: activo y verificado](#perfiles-activo-y-verificado).
- Ver catálogo unificado de proveedores (`GET /providers`): lista profesionales y empresas en una sola respuesta; filtro `providerType=PROFESSIONAL|COMPANY|ALL`. Usado en el frontend en la página de listado de especialistas y al crear una solicitud (elegir proveedor).
- Ver solicitudes disponibles (job board) (`GET /requests/available`).
- Expresar interés en solicitudes públicas (`POST /requests/:id/interest`).
- Ver y retirar su interés (`GET/DELETE /requests/:id/interest`).
- Ver solicitudes en las que está asignado (cambiar estado a IN_PROGRESS, DONE, agregar fotos).
- Calificar al cliente al finalizar el trabajo (`POST /requests/:id/rate-client`) **solo en solicitudes donde está asignado** (el backend valida con `canRateClientBy`; solo el proveedor asignado puede calificar).
- Gestionar galería de su perfil (agregar/eliminar fotos).

### No puede

- Ver interesados en una solicitud (solo el cliente dueño).
- Asignar proveedor a una solicitud (solo el cliente).
- Ver solicitudes privadas de otros (solo las propias o las públicas sin asignar).
- Moderar reseñas.
- Ver datos sensibles de otros proveedores en búsquedas (ej. en listados públicos no se exponen whatsapp/dirección completa).

---

## Admin

### Puede

- Todo lo anterior según los perfiles que tenga el usuario.
- Listar y ver usuarios (`GET /admin/users`, `GET /admin/users/:id`).
- Cambiar estado de usuarios (`PUT /admin/users/:id/status`).
- Listar y ver profesionales y empresas.
- Cambiar estado de profesionales y empresas (verificar, suspender, etc.).
- Verificar empresas (`POST /companies/:id/verify`).
- Listar requests con filtros (`GET /admin/requests`).
- Listar notificaciones y ver estadísticas de delivery (`GET /admin/notifications`, `GET /admin/notifications/stats`).
- Reenviar notificaciones fallidas (`POST /admin/notifications/:id/resend`).
- Ver reviews pendientes de moderación (`GET /reviews/admin/pending`).
- Aprobar o rechazar reviews (`POST /reviews/:id/approve`, `POST /reviews/:id/reject`).

### No puede (en el MVP)

- No hay roles intermedios (ej. “soporte” sin acceso total).
- La auditoría de acciones admin está en backlog.

---

## Resumen por recurso

| Recurso | Cliente (dueño) | Proveedor (asignado) | Proveedor (otro) | Admin |
|---------|------------------|----------------------|------------------|-------|
| **Request** (propia) | Ver, editar, fotos, estado, asignar, ver interesados | — | — | Ver, listar |
| **Request** (pública sin asignar) | — | Ver, expresar interés | Ver, expresar interés | Ver |
| **Request** (asignada a otro) | — | — | No ver | Ver |
| **Review** (propia PENDING) | — | — | — | Moderar |
| **Review** (propia) | Crear, editar, eliminar (si PENDING) | — | — | Ver, moderar |
| **Review** (aprobada pública) | Ver | Ver | Ver | Ver |
| **Perfil profesional/empresa** | — | Editar el propio | Ver público | Ver, cambiar estado |
| **Notificaciones** | Propias | Propias | Propias | Listar todas, reenviar |
| **Usuarios** | Ver/editar el propio | Idem | Idem | Listar, ver, cambiar estado |

---

## Referencias

- [Patrón de autorización](./architecture/AUTHORIZATION_PATTERN.md)
- [Estructura de la API](../API_STRUCTURE.md)
- [Company Profiles](./architecture/COMPANY_PROFILES.md)
