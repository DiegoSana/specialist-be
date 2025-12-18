# ADR-001: Dual Profile Architecture

**Status:** Accepted  
**Date:** December 2024  
**Decision Makers:** Development Team

---

## Context

The application initially used a single `role` enum (`CLIENT | PROFESSIONAL | ADMIN`) to determine user capabilities. This created a fundamental limitation: **a user could only be a client OR a professional, but not both**.

### Business Requirement

Allow users to be **both client and professional** simultaneously:
- A user can search and hire professionals (client functionality)
- The same user can offer professional services (professional functionality)

### Original Architecture

```
User
├── role: UserRole (CLIENT | PROFESSIONAL | ADMIN)
├── professional: Professional? (1:1, only if role = PROFESSIONAL)
└── Constraint: One role per user
```

---

## Decision

We chose **Option 5: Separate Client and Professional Profile Entities** combined with **composition over inheritance**.

### Architecture

```
User (Base Entity)
├── isAdmin: boolean
├── clientProfile: ClientProfile? (1:1)
├── professional: Professional? (1:1)
└── Capabilities determined by profile existence
    ├── hasClientProfile → can create requests
    └── hasProfessionalProfile → can offer services
```

---

## Options Considered

### Option 1: Remove Role Dependency (Capability-Based)
- Keep `role` field for backward compatibility
- Remove role validation when creating professional profile
- Check profile existence instead of role

**Pros:** Minimal changes, no migration  
**Cons:** No client-specific data storage, role becomes redundant  
**Effort:** LOW (4-6 days)

### Option 2: Multiple Roles Array
- Change `role` from enum to array: `roles: ['CLIENT', 'PROFESSIONAL']`

**Pros:** Explicit role tracking, scalable  
**Cons:** Breaking change, complex migration  
**Effort:** HIGH

### Option 3: Capabilities/Permissions System
- Add boolean flags: `isClient`, `isProfessional`, `isAdmin`

**Pros:** Explicit capabilities, flexible  
**Cons:** Redundancy with profiles, more fields  
**Effort:** MEDIUM

### Option 4: Role Hierarchy
- Define hierarchy: CLIENT < PROFESSIONAL < ADMIN
- Professional inherits client capabilities

**Pros:** Simple logic  
**Cons:** Not true dual role, confusing  
**Effort:** LOW

### Option 5: Separate Profile Entities ✅ CHOSEN
- Create `ClientProfile` entity
- User can have both profiles independently
- Remove `role` field (except for ADMIN)

**Pros:** Explicit data model, client-specific storage, future-proof  
**Cons:** Migration required, more entities  
**Effort:** MEDIUM (10-15 days)

---

## Why Composition Over Inheritance

### Inheritance Approach (NOT used)

```typescript
// ❌ Inheritance creates tight coupling
class Professional extends User {
  // Inherits ALL User fields
  // Has its own status field → CONFLICT with User.status
  tradeId: string;
  status: ProfessionalStatus; // Naming conflict!
}
```

**Problems:**
1. **Field conflicts:** Both User and Professional need `status` field
2. **Table duplication:** Would need separate tables or giant table with NULLs
3. **Rigidity:** Can't easily change from Professional to Client
4. **DDD violation:** Mixes bounded contexts (Identity vs Profiles)

### Composition Approach (USED)

```typescript
// ✅ Composition maintains separation
class UserEntity {
  id: string;
  email: string;
  status: UserStatus;
}

class ProfessionalEntity {
  id: string;
  userId: string; // Reference to User (composition)
  status: ProfessionalStatus; // No conflict!
}
```

**Benefits:**
1. **No conflicts:** Each entity has its own fields
2. **Separation of concerns:** User → Identity Context, Professional → Profiles Context
3. **Flexibility:** Can add/remove profiles without affecting User
4. **Clear 1:1 relationship:** Via `userId` foreign key

---

## Implementation

### Database Schema

```prisma
model User {
  id               String         @id @default(uuid())
  email            String         @unique
  isAdmin          Boolean        @default(false)
  status           UserStatus     @default(PENDING)
  
  // Profile relationships (composition)
  clientProfile    ClientProfile?
  professional     Professional?
}

model ClientProfile {
  id                  String   @id @default(uuid())
  userId              String   @unique
  preferences         Json?
  savedProfessionals  String[]
  
  user                User     @relation(fields: [userId], references: [id])
}

model Professional {
  id              String             @id @default(uuid())
  userId          String             @unique
  status          ProfessionalStatus
  // ... professional-specific fields
  
  user            User     @relation(fields: [userId], references: [id])
}
```

### Domain Entity

```typescript
export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly isAdmin: boolean,
    public readonly status: UserStatus,
    public readonly hasClientProfile: boolean,
    public readonly hasProfessionalProfile: boolean,
    // ... other fields
  ) {}

  // Capability checks based on profile existence
  isClient(): boolean {
    return this.hasClientProfile;
  }

  isProfessional(): boolean {
    return this.hasProfessionalProfile;
  }

  canCreateRequest(): boolean {
    return this.isActive() && this.hasClientProfile;
  }

  canCreateProfessionalProfile(): boolean {
    return this.isActive() && !this.hasProfessionalProfile;
  }
}
```

### Registration Flow

```typescript
async register(dto: RegisterDto) {
  // 1. Create user
  const user = await this.userRepository.create({
    email: dto.email,
    password: hashedPassword,
    status: UserStatus.PENDING,
  });

  // 2. Auto-create client profile for all users
  await this.clientProfileRepository.create({
    userId: user.id,
    preferences: null,
    savedProfessionals: [],
  });

  return { accessToken, user };
}
```

---

## Consequences

### Positive

1. **Dual Role Support:** Users can now be both clients and professionals
2. **Cleaner Architecture:** Profile-based checks are more explicit
3. **Client Features:** ClientProfile enables favorites, preferences, search history
4. **Scalability:** Easy to add more profile types (e.g., BusinessProfile)
5. **DDD Compliance:** Clear bounded context separation

### Negative

1. **Migration Required:** Database schema changes needed
2. **More Entities:** Additional repositories and services to maintain
3. **Learning Curve:** Team needs to understand profile-based architecture

### Neutral

1. **API Changes:** Auth responses now return profile flags instead of role
2. **Admin Handling:** Admin role retained separately via `isAdmin` field

---

## File Locations

After the bounded context refactor:

| Component | Location |
|-----------|----------|
| UserEntity | `src/identity/domain/entities/user.entity.ts` |
| ClientProfile | `src/profiles/domain/entities/client-profile.entity.ts` |
| ProfessionalEntity | `src/profiles/domain/entities/professional.entity.ts` |
| ClientService | `src/profiles/application/services/client.service.ts` |
| ProfessionalService | `src/profiles/application/services/professional.service.ts` |

---

## References

- Domain-Driven Design (Eric Evans)
- "Composition over Inheritance" principle
- NestJS documentation on module organization

