# Herencia vs Composición - Professional Profile

## 📚 Conceptos Fundamentales

### Herencia (Inheritance)
**"ES-UN"** (IS-A relationship)
- Una clase hereda de otra
- El hijo **es** una versión especializada del padre
- Relación fuerte y acoplada
- Ejemplo: `Professional extends User` → "Un Professional ES un User"

### Composición (Composition)
**"TIENE-UN"** (HAS-A relationship)
- Una clase **tiene** una referencia a otra
- Relación más flexible y desacoplada
- Ejemplo: `Professional` tiene un `userId` que referencia a `User` → "Un Professional TIENE un User"

---

## 🔄 Enfoque con Herencia (NO usado en este proyecto)

### Estructura con Herencia

```typescript
// ❌ Enfoque con Herencia
class User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
}

class Professional extends User {
  // Hereda TODOS los campos de User
  // Y agrega campos específicos
  tradeId: string;
  description: string;
  experienceYears: number;
  status: ProfessionalStatus; // ⚠️ Conflicto con User.status
  zone: string;
  // ... más campos
}
```

### Problemas de la Herencia

#### 1. **Conflicto de Campos**
```typescript
// User tiene: status: UserStatus
// Professional necesita: status: ProfessionalStatus
// ❌ No puedes tener ambos con el mismo nombre
```

#### 2. **Duplicación de Tablas**
```sql
-- Con herencia necesitarías:
users table (para CLIENT y ADMIN)
professionals table (para PROFESSIONAL, duplicando campos de User)
-- O una tabla gigante con muchos campos NULL
```

#### 3. **Rigidez**
```typescript
// Si un User quiere cambiar de rol:
// ❌ No puedes "convertir" un Professional en Client
// Tendrías que crear un nuevo objeto y migrar datos
```

#### 4. **Violación de DDD**
```typescript
// Professional "hereda" lógica de autenticación que no le corresponde
// Mezcla responsabilidades de diferentes bounded contexts
```

---

## ✅ Enfoque con Composición (Usado en este proyecto)

### Estructura con Composición

```typescript
// ✅ Enfoque con Composición

// 1. User (entidad base, todos los roles)
class UserEntity {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole; // CLIENT | PROFESSIONAL | ADMIN
  status: UserStatus;
  
  isProfessional(): boolean {
    return this.role === UserRole.PROFESSIONAL;
  }
}

// 2. Professional (entidad separada, referencia a User)
class ProfessionalEntity {
  id: string;
  userId: string; // ← Referencia a User (composición)
  tradeId: string;
  description: string | null;
  experienceYears: number | null;
  status: ProfessionalStatus; // ← Sin conflicto
  zone: string | null;
  // ... campos específicos de profesionales
}
```

### Ventajas de la Composición

#### 1. **Sin Conflictos de Campos**
```typescript
// User tiene: status: UserStatus (PENDING, ACTIVE, SUSPENDED, BANNED)
// Professional tiene: status: ProfessionalStatus (PENDING_VERIFICATION, VERIFIED, REJECTED)
// ✅ Cada uno tiene su propio estado sin conflictos
```

#### 2. **Separación de Responsabilidades**
```typescript
// User → User Management Context (autenticación, roles)
// Professional → Service Context (servicios, oficios)
// ✅ Cada bounded context maneja su propia entidad
```

#### 3. **Flexibilidad**
```typescript
// Un User puede cambiar de rol fácilmente:
user.role = UserRole.CLIENT; // Ya no es profesional
// El Professional profile puede eliminarse sin afectar el User
```

#### 4. **Relación 1:1 Clara**
```prisma
// En Prisma Schema:
model User {
  id       String        @id @default(uuid())
  role     UserRole      @default(CLIENT)
  // ...
  professional Professional? // ← Relación opcional 1:1
}

model Professional {
  id     String @id @default(uuid())
  userId String @unique // ← Foreign Key a User
  user   User   @relation(fields: [userId], references: [id])
  // ...
}
```

---

## 📊 Comparación Visual

### Con Herencia
```
┌─────────────────────┐
│      User           │
│  (clase base)       │
└─────────────────────┘
         ▲
         │ extends
         │
┌─────────────────────┐
│   Professional      │
│  (hereda todo)      │
└─────────────────────┘

Problema: Professional "es" User, pero también necesita
          ser una entidad independiente en otro contexto
```

### Con Composición (Actual)
```
┌─────────────────────┐      ┌─────────────────────┐
│      User           │      │   Professional       │
│  (User Management)  │◄─────┤  (Service Context)  │
│                     │      │                     │
│  - email            │      │  - userId (FK)       │
│  - password         │      │  - tradeId           │
│  - role             │      │  - description       │
│  - status           │      │  - status            │
└─────────────────────┘      └─────────────────────┘
         │                            │
         │                            │
    Bounded Context              Bounded Context
    separado                      separado

Ventaja: Cada entidad vive en su propio contexto,
         se relacionan pero no dependen directamente
```

---

## 💻 Ejemplos de Código

### Crear un Professional Profile (Composición)

```typescript
// 1. Primero existe el User
const user = await userRepository.create({
  email: "electrician@example.com",
  password: "hashed",
  firstName: "Juan",
  lastName: "Pérez",
  role: UserRole.PROFESSIONAL, // ← Rol asignado
  status: UserStatus.ACTIVE
});

// 2. Luego se crea el Professional profile
const professional = await professionalRepository.create({
  userId: user.id, // ← Composición: referencia al User
  tradeId: "electrician-trade-id",
  description: "Electrician with 10 years experience",
  status: ProfessionalStatus.PENDING_VERIFICATION
});

// ✅ User y Professional son entidades independientes
// ✅ Se relacionan a través de userId
```

### Obtener un Professional con su User (Composición)

```typescript
// Opción 1: Desde Professional
const professional = await professionalRepository.findById(id);
const user = await userRepository.findById(professional.userId);
// ✅ Accedes a ambos, pero son entidades separadas

// Opción 2: Con Prisma (incluye la relación)
const professional = await prisma.professional.findUnique({
  where: { id },
  include: { user: true } // ← Prisma maneja la relación
});
// ✅ Prisma une las entidades en la query
```

### Con Herencia (hipotético)

```typescript
// ❌ Con herencia sería:
class Professional extends User {
  // Ya tiene email, password, firstName, etc.
  tradeId: string;
  // ...
}

const professional = new Professional();
professional.email = "..."; // ← Heredado de User
professional.tradeId = "..."; // ← Propio de Professional
// ❌ Todo mezclado en una sola clase
```

---

## 🎯 ¿Por qué Composición en DDD?

### Principios DDD que favorecen Composición:

1. **Bounded Contexts Separados**
   - `User` vive en **User Management Context**
   - `Professional` vive en **Service Context**
   - Cada contexto tiene su propia entidad raíz (Aggregate Root)

2. **Agregados Independientes**
   - `User` es un Aggregate Root
   - `Professional` es otro Aggregate Root
   - Se relacionan pero no dependen directamente

3. **Responsabilidades Claras**
   - `User`: Autenticación, roles, estado de cuenta
   - `Professional`: Servicios, oficios, verificación profesional

4. **Flexibilidad**
   - Un User puede existir sin Professional (si es CLIENT o ADMIN)
   - Un Professional siempre tiene un User, pero son entidades separadas
   - Fácil cambiar roles sin afectar la estructura

---

## 📋 Resumen

| Aspecto | Herencia | Composición (Actual) |
|---------|----------|---------------------|
| **Relación** | "ES-UN" | "TIENE-UN" |
| **Acoplamiento** | Alto | Bajo |
| **Flexibilidad** | Baja | Alta |
| **DDD Compliance** | ❌ Mezcla contextos | ✅ Separa contextos |
| **Cambio de rol** | ❌ Difícil | ✅ Fácil |
| **Conflictos de campos** | ❌ Posibles | ✅ No hay |
| **Separación de responsabilidades** | ❌ Mezcladas | ✅ Claras |

---

## 🔍 En el Código Actual

### Estructura de Base de Datos (Prisma)

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  role          UserRole       @default(CLIENT)
  status        UserStatus     @default(PENDING)
  // ...
  professional  Professional?  // ← Relación opcional 1:1
}

model Professional {
  id              String   @id @default(uuid())
  userId          String   @unique  // ← Foreign Key (composición)
  user            User     @relation(fields: [userId], references: [id])
  tradeId         String
  status          ProfessionalStatus  // ← Sin conflicto con User.status
  // ...
}
```

### En el Código TypeScript

```typescript
// UserEntity - User Management Context
export class UserEntity {
  // Campos de autenticación y perfil básico
  role: UserRole;
  isProfessional(): boolean {
    return this.role === UserRole.PROFESSIONAL;
  }
}

// ProfessionalEntity - Service Context
export class ProfessionalEntity {
  userId: string; // ← Composición: referencia a User
  // Campos específicos de profesionales
  status: ProfessionalStatus; // ← Sin conflicto
}
```

---

## ✅ Conclusión

**Composición es mejor que Herencia para este caso porque:**

1. ✅ Respeta los Bounded Contexts de DDD
2. ✅ Evita conflictos de campos (status, etc.)
3. ✅ Permite flexibilidad (cambiar roles)
4. ✅ Mantiene responsabilidades separadas
5. ✅ Facilita el mantenimiento y testing
6. ✅ Es más escalable (fácil agregar nuevos roles)

**La relación es:**
- `Professional` **TIENE** un `User` (composición)
- NO: `Professional` **ES** un `User` (herencia)

Esto permite que cada entidad viva en su propio contexto y mantenga su independencia, siguiendo los principios de DDD.

