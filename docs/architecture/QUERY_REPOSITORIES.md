# Query Repositories - Patrón para Estadísticas y Queries de Lectura

**Fecha:** Febrero 2026  
**Estado:** Propuesta de diseño

---

## Contexto

Los repositorios de agregados (`UserRepository`, `RequestRepository`, etc.) están diseñados para trabajar con entidades de dominio (`UserEntity`, `RequestEntity`). Sin embargo, tenemos necesidades de:

1. **Estadísticas agregadas** (`getUserStats()`, `getRequestStats()`) que devuelven datos calculados, no entidades
2. **Queries de admin** (`findAllForAdmin()`, `findByIdForAdmin()`) que devuelven DTOs específicos para visualización

Esto viola el principio de que los repositorios devuelven entidades de dominio.

---

## Opción B: Query Repositories Separados

### Estructura

```
src/
├── identity/
│   ├── domain/
│   │   ├── repositories/
│   │   │   └── user.repository.ts          # Aggregate Repository (entidades)
│   │   └── queries/                        # Nueva carpeta
│   │       └── user.query-repository.ts    # Query Repository (estadísticas, DTOs)
│   └── infrastructure/
│       └── queries/                        # Nueva carpeta
│           └── prisma-user.query-repository.ts
```

### Capas

1. **Domain Layer** (`domain/queries/`):
   - **Interfaz** del Query Repository (port)
   - Define los contratos de consulta
   - Puede definir Value Objects para estadísticas si tienen lógica de negocio

2. **Infrastructure Layer** (`infrastructure/queries/`):
   - **Implementación** usando Prisma directamente
   - Mapea datos de Prisma a Value Objects o tipos planos según corresponda

3. **Application Layer** (`application/services/`):
   - Los servicios consumen Query Repositories igual que Aggregate Repositories
   - Los servicios exponen métodos públicos para otros bounded contexts

---

## Respuestas a las Preguntas

### 1. ¿Necesitaríamos Value Objects también?

**Respuesta:** Depende del caso:

- **Estadísticas simples** (solo números): Pueden ser tipos planos (`UserStats`, `RequestStats`)
- **Estadísticas con lógica**: Deberían ser Value Objects si tienen:
  - Validaciones (ej: porcentajes entre 0-100)
  - Métodos de cálculo (ej: `growthRate()`, `isHealthy()`)
  - Comparaciones (ej: `isBetterThan(other)`)

**Recomendación:** Empezar con tipos planos y evolucionar a Value Objects si surge lógica de negocio.

### 2. ¿En qué capa estarían los Query Repositories?

**Respuesta:** Misma estructura que Aggregate Repositories:

```
Domain Layer (interfaz):
  src/identity/domain/queries/user.query-repository.ts

Infrastructure Layer (implementación):
  src/identity/infrastructure/queries/prisma-user.query-repository.ts
```

**Razón:** Los Query Repositories son **ports** (interfaces) en Domain e **adapters** (implementaciones) en Infrastructure, igual que los Aggregate Repositories.

### 3. ¿Los Query Repositories son consumidos por los servicios de su bounded context?

**Respuesta:** Sí, exactamente igual que los Aggregate Repositories:

```typescript
// UserService (Application Layer)
@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) 
    private readonly userRepository: UserRepository,  // Aggregate
    
    @Inject(USER_QUERY_REPOSITORY)
    private readonly userQueryRepository: UserQueryRepository,  // Query
  ) {}

  // Métodos que usan Aggregate Repository
  async findById(id: string): Promise<UserEntity> {
    return this.userRepository.findById(id);
  }

  // Métodos que usan Query Repository
  async getUserStats(): Promise<UserStats> {
    return this.userQueryRepository.getUserStats();
  }
}
```

**Regla:** Los Query Repositories son **internos** al bounded context, igual que los Aggregate Repositories. Otros contextos acceden a través de los servicios.

---

## Ejemplo de Implementación

### Domain Layer - Interfaz

```typescript
// src/identity/domain/queries/user.query-repository.ts

export type UserStats = {
  total: number;
  newLast7Days: number;
  newLast30Days: number;
  activeLast30Days: number;
};

export interface UserQueryRepository {
  getUserStats(): Promise<UserStats>;
  
  findAllForAdmin(params: {
    skip: number;
    take: number;
  }): Promise<{
    users: Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
      createdAt: Date;
      client: { id: string } | null;
      professional: { id: string } | null;
    }>;
    total: number;
  }>;
}

export const USER_QUERY_REPOSITORY = Symbol('UserQueryRepository');
```

### Infrastructure Layer - Implementación

```typescript
// src/identity/infrastructure/queries/prisma-user.query-repository.ts

@Injectable()
export class PrismaUserQueryRepository implements UserQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserStats(): Promise<UserStats> {
    // Usa Prisma directamente ✅ (está en infrastructure)
    const [total, newLast7Days, ...] = await Promise.all([
      this.prisma.user.count(),
      // ...
    ]);
    return { total, newLast7Days, ... };
  }

  async findAllForAdmin(params) {
    // Usa Prisma directamente ✅
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({...}),
      this.prisma.user.count(),
    ]);
    return { users, total };
  }
}
```

### Application Layer - Servicio

```typescript
// src/identity/application/services/user.service.ts

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) 
    private readonly userRepository: UserRepository,
    
    @Inject(USER_QUERY_REPOSITORY)
    private readonly userQueryRepository: UserQueryRepository,
  ) {}

  // Usa Aggregate Repository
  async findById(id: string): Promise<UserEntity> {
    return this.userRepository.findById(id);
  }

  // Usa Query Repository
  async getUserStats(): Promise<UserStats> {
    return this.userQueryRepository.getUserStats();
  }

  async getAllUsersForAdmin(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const { users, total } = await this.userQueryRepository.findAllForAdmin({
      skip,
      take: limit,
    });
    return { data: users, meta: { total, page, limit, ... } };
  }
}
```

---

## Ventajas de Query Repositories

1. ✅ **Separación clara**: Aggregate Repositories solo devuelven entidades de dominio
2. ✅ **Consistencia**: Todos los repositorios siguen el mismo patrón (Domain interface, Infrastructure implementation)
3. ✅ **Escalabilidad**: Fácil agregar más queries sin contaminar el Aggregate Repository
4. ✅ **Testabilidad**: Se pueden mockear independientemente
5. ✅ **Flexibilidad**: Pueden usar diferentes estrategias de lectura (caché, read replicas, etc.)

---

## Desventajas / Tradeoffs

1. ⚠️ **Más archivos**: Requiere crear nuevas interfaces e implementaciones
2. ⚠️ **Más inyección**: Los servicios necesitan ambos repositorios
3. ⚠️ **Complejidad inicial**: Más estructura que mantener

---

## Comparación con Opción A (Value Objects en Aggregate Repository)

| Aspecto | Opción A (VO en Aggregate) | Opción B (Query Repository) |
|---------|----------------------------|----------------------------|
| **Separación** | Menos separación | Separación clara |
| **Complejidad** | Menos archivos | Más archivos |
| **Escalabilidad** | Puede crecer desordenado | Escala mejor |
| **Consistencia** | Mezcla queries con agregados | Queries separadas |
| **DDD Puro** | Menos estricto | Más estricto |

---

## Recomendación

**Opción B (Query Repositories)** es más alineada con DDD y Clean Architecture, aunque requiere más estructura inicial. Es la opción más escalable y mantenible a largo plazo.

---

## Referencias

- ADR-002-DDD-PERSISTENCE-BOUNDARIES.md: "Some read-heavy operations remain as query methods in repositories until a dedicated read-model/query repository is introduced."
- ProfessionalRepository comentario: "En una separación más estricta, esto viviría en un 'ProfessionalQueryRepository' fuera del contrato de aggregate."

