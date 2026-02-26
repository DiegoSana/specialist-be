# Orquestación de "Perfil Activo" y AuthContexts

> Un solo punto que define qué es "perfil activo" para cada tipo (Cliente, Profesional, Empresa). El resto del código usa AuthContexts alimentados por este servicio; no se llama `user.isFullyVerified()` repartido por servicios.

---

## 1. Objetivo

- **Una sola fuente de verdad** para "usuario con perfil activo" (cliente activo, proveedor activo).
- **Responsabilidades claras**: Identity expone `user.isFullyVerified()`; Profiles expone `profile.canOperate()`. Un **servicio de orquestación** compone ambos y expone `hasActiveClientProfile(userId)` y `hasActiveProviderProfile(userId)`.
- **AuthContexts** se construyen usando ese servicio; las entidades de dominio reciben en el contexto flags como `hasActiveClientProfile` / `hasActiveProviderProfile` y no conocen la fórmula.

---

## 2. Definición de "perfil activo" por tipo

| Perfil | "Activo" significa | Fórmula (en orquestación) |
|--------|---------------------|----------------------------|
| **Cliente** | Puede crear solicitudes, asignar proveedor (acciones de cliente). | `user.hasClientProfile && user.isFullyVerified()` |
| **Profesional** | Aparece en catálogo, puede expresar interés, job board, ser asignado. | `profile.canOperate() && user.isFullyVerified()` (profile = Professional) |
| **Empresa** | Igual que profesional (catálogo, interés, asignación). | `profile.canOperate() && user.isFullyVerified()` (profile = Company) |

**Proveedor activo** (unificado): tiene perfil Professional o Company **y** ese perfil `canOperate()` **y** `user.isFullyVerified()`.

- `canOperate()` en dominio de Profiles: solo estado del perfil (`status === ACTIVE \|\| VERIFIED`). No conoce al usuario. (Tras migración de contacto unificado, el campo `active` se eliminó; solo cuenta el status.)
- La orquestación añade la condición del usuario (email + teléfono verificados).

---

## 3. Servicio de orquestación

**Nombre propuesto:** `ProfileActivationService` (en módulo **Profiles**).

**Responsabilidad:** Dado un `userId`, devolver el estado de activación de sus perfiles (cliente y proveedor), componiendo User (Identity) y Professional/Company (Profiles).

**Interfaz propuesta:**

```ts
// profiles/application/services/profile-activation.service.ts (o en domain/ports)

interface UserProfileActivationStatus {
  hasActiveClientProfile: boolean;
  hasActiveProviderProfile: boolean;
  /** Id del perfil proveedor activo (Professional o Company) si hay uno */
  activeServiceProviderId?: string | null;
}

getActivationStatus(userId: string): Promise<UserProfileActivationStatus>;
```

- **hasActiveClientProfile**: `user.hasClientProfile && user.isFullyVerified()` (UserService).
- **hasActiveProviderProfile**: existe Professional o Company para ese user, `profile.canOperate()` y `user.isFullyVerified()`. Si ambos perfiles existen, se considera activo el que cumpla canOperate (status ACTIVE/VERIFIED).
- **activeServiceProviderId**: el `serviceProviderId` del perfil proveedor que está operando (para no tener que volver a resolverlo en Request).

**Dependencias del servicio:** UserService (Identity), ProfessionalService/CompanyService o repos de Profiles para cargar perfil por userId y llamar a `canOperate()`.

**Ubicación:** Módulo Profiles (porque "perfil activo" es un concepto de perfiles; solo consume Identity para verificación).

---

## 4. Uso en AuthContexts

### 4.1 RequestAuthContext (y extensiones)

**Campos a incluir** (alimentados por orquestación):

- `hasActiveClientProfile?: boolean` — para reglas "solo cliente activo" (crear request, asignar proveedor si se exige).
- `hasActiveProviderProfile?: boolean` — para reglas "solo proveedor activo" (expresar interés, job board si se restringe).
- `serviceProviderId?: string | null` — ya existe.
- `userId`, `isAdmin` — ya existen.

Quién construye el contexto (RequestService, RequestInterestService) debe llamar a `ProfileActivationService.getActivationStatus(userId)` y rellenar estos campos. Así **no se llama `user.isFullyVerified()`** en Requests ni en otros módulos; solo se usa el resultado de la orquestación.

### 4.2 Construcción del contexto (buildAuthContext)

- **RequestService.buildAuthContext(userId, isAdmin)**  
  Debe obtener `getActivationStatus(userId)` y devolver `RequestAuthContext` con `hasActiveClientProfile`, `hasActiveProviderProfile` y `serviceProviderId` (este último ya se resuelve hoy; puede coincidir con `activeServiceProviderId` del status para no duplicar lógica).

- **RequestInterestService.buildAuthContext(userId, isAdmin)**  
  Debe usar el mismo `getActivationStatus(userId)` para rellenar `hasActiveProviderProfile` (y opcionalmente `serviceProviderId` si se obtiene de ahí). Se elimina la composición inline de `user.isFullyVerified()` y `profile.canOperate()`.

### 4.3 Otros contextos (Identity, Profiles, Reputation, Notifications)

- **UserAuthContext**, **ProfessionalAuthContext**, **CompanyAuthContext**, **ReviewAuthContext**, **NotificationAuthContext**: hoy no necesitan "perfil activo" para sus reglas (solo userId, isAdmin, isReviewer, etc.). Si en el futuro alguna acción exige "solo si cliente/proveedor activo", se puede añadir al contexto correspondiente un flag que venga de la orquestación, sin duplicar la fórmula.

---

## 5. Reglas de dominio que usan "activo"

- **RequestEntity**
  - `canExpressInterestBy(ctx)`: ya usa `ctx.hasActiveProviderProfile`. El contexto se alimenta con orquestación.
  - (Futuro) `canAssignProviderBy(ctx)`: si se exige "solo cliente activo para asignar", se puede añadir `if (!ctx.hasActiveClientProfile) return false` (solo después de que el contexto incluya `hasActiveClientProfile` desde orquestación).
- **RequestService.create()**  
  Reemplazar la comprobación actual `user.isFullyVerified()` por: obtener `getActivationStatus(clientId)` y comprobar `hasActiveClientProfile`; si no, 400 con mensaje claro.

Ninguna entidad de dominio debe llamar a Identity ni calcular `isFullyVerified()`; solo leen el contexto que ya trae los booleanos.

---

## 6. Auditoría: endpoints y acciones por rol (según PERMISSIONS_BY_ROLE)

Acciones que deben usar AuthContext (y dónde aplicar orquestación) se resumen en la tabla siguiente. "Orquestación" = usar `ProfileActivationService.getActivationStatus()` para rellenar el contexto o para una validación explícita.

| Acción / Endpoint | Rol | Contexto actual | Cambio / uso orquestación |
|-------------------|-----|------------------|----------------------------|
| **POST /requests** (crear) | Cliente | RequestService.create() comprueba hasActiveClientProfile (orquestación). Aplica a solicitud pública y directa. | Ya implementado. |
| **GET /requests/available** (job board) | Proveedor | RequestService/Controller | Si se exige "solo proveedor activo": contexto con hasActiveProviderProfile desde orquestación; validar antes de listar. |
| **POST /requests/:id/interest** | Proveedor | RequestInterestService.buildAuthContext + canExpressInterestBy(ctx) | buildAuthContext debe usar orquestación para hasActiveProviderProfile; no componer inline. |
| **DELETE /requests/:id/interest** | Proveedor | RequestInterestService | Mismo contexto; no requiere "activo" para retirar (solo tener perfil). Opcional exigir activo. |
| **GET /requests/:id/interests** | Cliente (dueño) | getInterestedProviders: isOwner en servicio | Ya correcto; si se exige "cliente activo" para ver interesados, añadir hasActiveClientProfile al contexto y usarlo en dominio/servicio. |
| **POST /requests/:id/assign** | Cliente (dueño) | canAssignProviderBy(ctx) | Opcional: exigir hasActiveClientProfile (orquestación) para asignar. |
| **PATCH /requests/:id** (estado, etc.) | Cliente o Proveedor | canChangeStatusBy, canBeViewedBy, etc. | Contexto con hasActiveClientProfile/hasActiveProviderProfile si alguna transición la restringimos a "solo activo". |
| **POST /requests/:id/rate-client** | Proveedor asignado | canRateClientBy(ctx) | Sin cambio de "activo"; ya es por asignación. |
| **POST /professionals/me/activate** | Usuario con perfil prof. | ProfileActivationPolicy, ProfileToggleService | Opcional: exigir user.isFullyVerified() para activar; puede hacerse llamando orquestación (hasActiveProviderProfile requiere canOperate, así que para "activar" podría ser solo isFullyVerified hasta que el perfil pase a canOperate). Definir si "activar" exige usuario verificado; si sí, orquestación puede exponer `isUserFullyVerified(userId)` o usarse getActivationStatus y lógica específica. |
| **POST /companies/me/activate** | Usuario con perfil company | Igual | Igual que profesionales. |
| **GET /providers** (listado) | Público / filtro backend | Repos con `userVerified: true` | Implementado: solo perfiles que pueden operar (status ACTIVE/VERIFIED) **y** usuario con emailVerified y phoneVerified. Criterio `onlyActiveInCatalog` en ProfessionalService y CompanyService; ProvidersController lo usa. |
| **GET /users/me** (provider-profiles) | Usuario | UsersController / UserService | Respuesta puede incluir "active" por perfil; si "active" debe reflejar verificación, puede usar orquestación para exponer hasActiveClientProfile / hasActiveProviderProfile. |
| Identity, Reviews, Notifications, Admin | Varios | Sus propios AuthContexts | Sin cambio salvo que alguna acción pase a requerir "perfil activo"; entonces se alimentaría el contexto con datos de orquestación. |

Resumen de implementación:

1. **Implementar ProfileActivationService** en Profiles con `getActivationStatus(userId)`.
2. **RequestService.create()**: dejar de usar `user.isFullyVerified()`; usar `getActivationStatus(clientId).hasActiveClientProfile`.
3. **RequestService.buildAuthContext()**: llamar a `getActivationStatus(userId)` y devolver `hasActiveClientProfile`, `hasActiveProviderProfile` y `serviceProviderId` (este puede venir de orquestación si se expone `activeServiceProviderId`).
4. **RequestInterestService.buildAuthContext()**: dejar de componer inline; usar `getActivationStatus(userId)` para `hasActiveProviderProfile` (y `serviceProviderId` si aplica).
5. **Opcional:** Añadir `hasActiveClientProfile` a RequestAuthContext y usarlo en `canAssignProviderBy` o en validaciones de "solo cliente activo".
6. **Opcional:** GET /requests/available y GET /providers: si se exige usuario/proveedor activo, usar orquestación en la capa que construye el contexto o el filtro.
7. **Documentar** en PERMISSIONS_BY_ROLE y en AUTHORIZATION_PATTERN que "perfil activo" se obtiene vía ProfileActivationService y que los AuthContexts se alimentan desde ahí.

---

## 7. Orden de implementación sugerido

1. Crear **ProfileActivationService** + interfaz `UserProfileActivationStatus` en Profiles; inyectar UserService y usar ProfessionalService/CompanyService (o repos) para implementar `getActivationStatus`.
2. Sustituir en **RequestService.create()** la comprobación actual por `getActivationStatus(clientId).hasActiveClientProfile`.
3. Sustituir en **RequestInterestService.buildAuthContext()** la composición inline por `getActivationStatus(userId)` para `hasActiveProviderProfile` (y `serviceProviderId` si se unifica).
4. Actualizar **RequestService.buildAuthContext()** para incluir `hasActiveClientProfile` y `hasActiveProviderProfile` desde orquestación (y, si aplica, `serviceProviderId` desde orquestación).
5. Revisar **PERMISSIONS_BY_ROLE** y **AUTHORIZATION_PATTERN**: añadir subsección "Orquestación de perfil activo" y referencia a este doc.
6. (Opcional) Exigir "cliente activo" para asignar y "proveedor activo" para job board/listado según la tabla anterior.

Con esto, la lógica de "perfil activo" queda centralizada y todos los servicios que dependan de ella usarán AuthContexts alimentados por el mismo servicio.
