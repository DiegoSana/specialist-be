# 🔐 Patrón de Autorización: Híbrido Service + Domain

> Documentación del patrón de validación de permisos implementado en Specialist.

---

## 📋 Índice

1. [Visión General](#visión-general)
2. [Arquitectura del Patrón](#arquitectura-del-patrón)
3. [Componentes](#componentes)
4. [Implementación](#implementación)
5. [Ejemplos](#ejemplos)
6. [Guía de Migración](#guía-de-migración)
7. [Testing](#testing)

---

## Visión General

### Problema

En aplicaciones con múltiples roles y reglas de negocio complejas, la validación de permisos puede dispersarse entre:
- Guards de NestJS (solo autenticación básica)
- Controladores (validación manual)
- Servicios (lógica duplicada)

Esto genera:
- **Duplicación** de código
- **Inconsistencia** en las validaciones
- **Dificultad** para testear
- **Acoplamiento** entre capas

### Solución: Patrón Híbrido

Centralizamos la **lógica de autorización en el dominio** (entidades), mientras el **servicio orquesta** la validación.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│ Controller  │────▶│   Service   │────▶│  Domain Entity  │
│             │     │             │     │                 │
│ - JwtGuard  │     │ - buildCtx  │     │ - canViewBy()   │
│ - CurrentUser│    │ - validate  │     │ - canModifyBy() │
│             │     │ - throw 403 │     │ - canDeleteBy() │
└─────────────┘     └─────────────┘     └─────────────────┘
     ↓                    ↓                     ↓
   Simple            Orquestador            Reglas de
   Auth               Permisos              Negocio
```

---

## Arquitectura del Patrón

### Principios

1. **Single Source of Truth**: Las reglas de permisos viven en el dominio
2. **Tell, Don't Ask**: Preguntamos a la entidad si una acción está permitida
3. **Contexto Explícito**: Usamos un `AuthContext` tipado para pasar información del usuario
4. **Fail Fast**: El servicio lanza excepciones claras si no hay permiso

### Capas de Responsabilidad

| Capa | Responsabilidad |
|------|-----------------|
| **Guard** | Autenticación (¿está logueado?) |
| **Controller** | Extraer usuario, delegar a servicio |
| **Service** | Construir contexto (usando [ProfileActivationService](./PROFILE_ACTIVATION_ORCHESTRATION.md) para flags de perfil activo), validar con dominio, lanzar excepciones |
| **Entity** | Definir reglas de negocio (quién puede hacer qué) |

---

## Componentes

### 1. AuthContext Interface

Define el contexto de autorización con información del usuario actual.

```typescript
// domain/entities/[entity].entity.ts

export interface RequestAuthContext {
  userId: string;
  isAdmin: boolean;
  isClient: boolean;          // Es el cliente que creó la solicitud
  isProfessional: boolean;    // Es el especialista asignado
  hasProfessionalProfile: boolean;
}

export interface ReviewAuthContext {
  userId: string;
  isAdmin: boolean;
  isReviewer: boolean;        // Es quien creó la review
}
```

### 2. Métodos de Autorización en Entity

Métodos que encapsulan las reglas de negocio.

```typescript
// domain/entities/request.entity.ts

export class RequestEntity {
  // Helper para construir contexto
  buildAuthContext(
    userId: string,
    isAdmin: boolean,
    hasProfessionalProfile: boolean,
  ): RequestAuthContext {
    return {
      userId,
      isAdmin,
      isClient: this.clientId === userId,
      isProfessional: this.professionalId === userId,
      hasProfessionalProfile,
    };
  }

  // Reglas de visualización
  canBeViewedBy(ctx: RequestAuthContext): boolean {
    // Admins pueden ver todo
    if (ctx.isAdmin) return true;
    
    // Cliente y profesional asignado pueden ver
    if (ctx.isClient || ctx.isProfessional) return true;
    
    // Solicitudes públicas sin asignar: cualquier profesional
    if (this.isPublic && !this.professionalId && ctx.hasProfessionalProfile) {
      return true;
    }
    
    return false;
  }

  // Reglas de modificación
  canBeModifiedBy(ctx: RequestAuthContext): boolean {
    if (ctx.isAdmin) return true;
    return ctx.isClient;
  }

  // Reglas de cambio de estado
  canChangeStatusBy(ctx: RequestAuthContext, newStatus: RequestStatus): boolean {
    if (ctx.isAdmin) return true;
    
    // Tabla declarativa TRANSITIONS[estadoActual][nuevoEstado] -> actores permitidos
    // (CLIENT | PROVIDER | SYSTEM | SUPPORT), ver request.entity.ts
    const actor = this.resolveActorKind(ctx);
    return !!TRANSITIONS[this.status]?.[newStatus]?.includes(actor);
  }
}
```

### 3. Helper en Service

El servicio construye el contexto y valida.

```typescript
// application/services/request.service.ts

@Injectable()
export class RequestService {
  
  async buildAuthContext(
    request: RequestEntity,
    userId: string,
  ): Promise<RequestAuthContext> {
    const user = await this.userService.findById(userId, true);
    return request.buildAuthContext(
      userId,
      user?.isAdmin ?? false,
      user?.hasProfessionalProfile ?? false,
    );
  }

  async findByIdForUser(id: string, userId: string): Promise<RequestEntity> {
    const request = await this.findById(id);
    const ctx = await this.buildAuthContext(request, userId);

    if (!request.canBeViewedBy(ctx)) {
      throw new ForbiddenException(
        'You do not have permission to view this request'
      );
    }

    return request;
  }

  async updateStatus(
    id: string,
    userId: string,
    newStatus: RequestStatus,
  ): Promise<RequestEntity> {
    const request = await this.findById(id);
    const ctx = await this.buildAuthContext(request, userId);

    if (!request.canChangeStatusBy(ctx, newStatus)) {
      throw new ForbiddenException(
        'You do not have permission to change this request status'
      );
    }

    // Proceder con la actualización...
  }
}
```

### 4. Controller Simplificado

El controller solo extrae el usuario y delega.

```typescript
// presentation/requests.controller.ts

@Controller('requests')
export class RequestsController {
  
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ) {
    // Delegamos completamente al servicio
    return this.requestService.findByIdForUser(id, user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.requestService.updateStatus(id, user.id, dto.status);
  }
}
```

---

## Ejemplos

### Request (Solicitud)

```typescript
// ¿Quién puede ver una solicitud?
canBeViewedBy(ctx: RequestAuthContext): boolean {
  if (ctx.isAdmin) return true;                    // Admin: siempre
  if (ctx.isClient) return true;                   // Cliente dueño: siempre
  if (ctx.isProfessional) return true;             // Profesional asignado: siempre
  if (this.isPublic && !this.professionalId) {     // Pública sin asignar:
    return ctx.hasProfessionalProfile;             //   cualquier profesional
  }
  return false;
}

// ¿Quién puede agregar fotos?
canManagePhotosBy(ctx: RequestAuthContext): boolean {
  if (ctx.isAdmin) return true;
  if (!this.professionalId) return ctx.isClient;   // Sin asignar: solo cliente
  return ctx.isClient || ctx.isProfessional;       // Asignada: cliente o profesional
}

// ¿Quién puede cambiar estado?
canChangeStatusBy(ctx: RequestAuthContext, newStatus: RequestStatus): boolean {
  if (ctx.isAdmin) return true;
  
  // Ver TRANSITIONS en request.entity.ts (actores CLIENT/PROVIDER/SYSTEM/SUPPORT)
  const actor = this.resolveActorKind(ctx);
  if (TRANSITIONS[this.status]?.[newStatus]?.includes(actor)) return true;
  
  return false;
}
```

### Review (Reseña)

```typescript
// ¿Quién puede ver una reseña?
canBeViewedBy(ctx: ReviewAuthContext): boolean {
  if (this.isApproved()) return true;    // Aprobadas: públicas
  return ctx.isReviewer || ctx.isAdmin;  // Pendientes/rechazadas: autor o admin
}

// ¿Quién puede modificar una reseña?
canBeModifiedBy(ctx: ReviewAuthContext): boolean {
  if (!ctx.isReviewer) return false;     // Solo el autor
  return this.isPending();               // Solo mientras está pendiente
}

// ¿Quién puede moderar una reseña?
canBeModeratedBy(ctx: ReviewAuthContext): boolean {
  if (!ctx.isAdmin) return false;        // Solo admins
  return this.isPending();               // Solo pendientes
}
```

---

## Guía de Migración

### Paso 1: Crear AuthContext

```typescript
// Antes: sin contexto tipado
if (user.id !== entity.ownerId && !user.isAdmin) {
  throw new ForbiddenException();
}

// Después: con AuthContext
export interface MyEntityAuthContext {
  userId: string;
  isAdmin: boolean;
  isOwner: boolean;
}
```

### Paso 2: Agregar Métodos a Entity

```typescript
// Agregar a la entidad
buildAuthContext(userId: string, isAdmin: boolean): MyEntityAuthContext {
  return {
    userId,
    isAdmin,
    isOwner: this.ownerId === userId,
  };
}

canBeViewedBy(ctx: MyEntityAuthContext): boolean {
  return ctx.isOwner || ctx.isAdmin;
}

canBeModifiedBy(ctx: MyEntityAuthContext): boolean {
  return ctx.isOwner || ctx.isAdmin;
}
```

### Paso 3: Refactorizar Service

```typescript
// Antes
async update(id: string, userId: string, dto: UpdateDto) {
  const entity = await this.findById(id);
  if (entity.ownerId !== userId) {
    throw new ForbiddenException();
  }
  // actualizar...
}

// Después
async update(id: string, userId: string, dto: UpdateDto) {
  const entity = await this.findById(id);
  const ctx = await this.buildAuthContext(entity, userId);
  
  if (!entity.canBeModifiedBy(ctx)) {
    throw new ForbiddenException('You cannot modify this entity');
  }
  // actualizar...
}
```

### Paso 4: Simplificar Controller

```typescript
// Antes: validación en controller
@Patch(':id')
async update(@Param('id') id: string, @CurrentUser() user, @Body() dto) {
  const entity = await this.service.findById(id);
  if (entity.ownerId !== user.id && !user.isAdmin) {
    throw new ForbiddenException();
  }
  return this.service.update(id, dto);
}

// Después: solo delegación
@Patch(':id')
async update(@Param('id') id: string, @CurrentUser() user, @Body() dto) {
  return this.service.update(id, user.id, dto);
}
```

---

## Testing

### Tests de Autorización en Dominio

```typescript
describe('canBeViewedBy', () => {
  it('should allow admin to view any entity', () => {
    const entity = createEntity({ ownerId: 'user-1' });
    const ctx = { userId: 'admin', isAdmin: true, isOwner: false };
    
    expect(entity.canBeViewedBy(ctx)).toBe(true);
  });

  it('should allow owner to view their entity', () => {
    const entity = createEntity({ ownerId: 'user-1' });
    const ctx = { userId: 'user-1', isAdmin: false, isOwner: true };
    
    expect(entity.canBeViewedBy(ctx)).toBe(true);
  });

  it('should deny non-owner non-admin', () => {
    const entity = createEntity({ ownerId: 'user-1' });
    const ctx = { userId: 'user-2', isAdmin: false, isOwner: false };
    
    expect(entity.canBeViewedBy(ctx)).toBe(false);
  });
});
```

### Tests de Servicio

```typescript
describe('findByIdForUser', () => {
  it('should return entity when user has permission', async () => {
    const entity = createEntity({ ownerId: 'user-1' });
    mockRepository.findById.mockResolvedValue(entity);
    mockUserService.findById.mockResolvedValue({ isAdmin: false });
    
    const result = await service.findByIdForUser('entity-1', 'user-1');
    
    expect(result).toEqual(entity);
  });

  it('should throw ForbiddenException when no permission', async () => {
    const entity = createEntity({ ownerId: 'user-1' });
    mockRepository.findById.mockResolvedValue(entity);
    mockUserService.findById.mockResolvedValue({ isAdmin: false });
    
    await expect(
      service.findByIdForUser('entity-1', 'user-2')
    ).rejects.toThrow(ForbiddenException);
  });
});
```

---

## Checklist de Implementación

- [ ] Crear `AuthContext` interface en entity
- [ ] Agregar `buildAuthContext()` a entity
- [ ] Agregar métodos `canXxxBy()` para cada operación
- [ ] Crear `buildAuthContext()` en service
- [ ] Crear métodos `xxxForUser()` en service
- [ ] Refactorizar métodos existentes para usar contexto
- [ ] Simplificar controller (solo delegación)
- [ ] Actualizar tests
- [ ] Documentar reglas de negocio en comentarios

---

## Módulos Implementados

| Módulo | Estado | AuthContext | Métodos |
|--------|--------|-------------|---------|
| Requests | ✅ | `RequestAuthContext` | `canBeViewedBy`, `canBeModifiedBy`, `canChangeStatusBy`, `canManagePhotosBy`, `canRateClientBy`, `canExpressInterestBy`, `canAssignProfessionalBy` |
| Reviews | ✅ | `ReviewAuthContext` | `canBeViewedBy`, `canBeModifiedBy`, `canBeModeratedBy` |
| Notifications | ⬜ | Pendiente | - |
| Profiles | ⬜ | Pendiente | - |
| Identity | ⬜ | Pendiente | - |

---

## Referencias

- [Clean Architecture - Uncle Bob](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design - Eric Evans](https://www.domainlanguage.com/ddd/)
- [Tell, Don't Ask Principle](https://martinfowler.com/bliki/TellDontAsk.html)

