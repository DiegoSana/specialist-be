# User Profiles Architecture - Specialist

> Updated December 2024 - Dual Profile System

## Design: Dual Profile Model

### Overview

Users can have **zero, one, or both** profiles:
- **Client Profile**: Can create service requests
- **Professional Profile**: Can receive and work on requests

This allows a single user to be both a client (seeking services) and a professional (offering services).

### Profile Flags

```typescript
User {
  hasClientProfile: boolean;      // Has activated client profile
  hasProfessionalProfile: boolean; // Has professional profile
  isAdmin: boolean;               // Admin privileges
}
```

### Profile Structure

```
User (Identity)
├── Basic data (email, name, phone, auth)
├── hasClientProfile: boolean
├── hasProfessionalProfile: boolean
└── isAdmin: boolean

┌─────────────────────────────────────────────────────────┐
│                     PROFILES                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Client Profile (if hasClientProfile)                   │
│  ├── Can search professionals                          │
│  ├── Can create requests (public or direct)            │
│  ├── Can accept quotes                                 │
│  ├── Can leave reviews                                 │
│  └── Can view interested professionals                 │
│                                                          │
│  Professional Profile (if hasProfessionalProfile)      │
│  ├── Has trades/specialties                            │
│  ├── Has gallery and description                       │
│  ├── Can receive direct requests                       │
│  ├── Can express interest in public requests          │
│  ├── Can submit quotes                                 │
│  └── Has ratings and reviews                           │
│                                                          │
│  Admin (if isAdmin)                                     │
│  ├── Full system access                                │
│  ├── User management                                   │
│  └── Professional verification                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### 1. User Entity

```typescript
// src/identity/domain/entities/user.entity.ts
export class UserEntity {
  id: string;
  email: string;
  hasClientProfile: boolean;
  hasProfessionalProfile: boolean;
  isAdmin: boolean;
  
  isClient(): boolean {
    return this.hasClientProfile;
  }
  
  isProfessional(): boolean {
    return this.hasProfessionalProfile;
  }
  
  isAdminUser(): boolean {
    return this.isAdmin;
  }
}
```

### 2. Profile Entities

```typescript
// src/profiles/domain/entities/client.entity.ts
export class ClientEntity {
  id: string;
  userId: string;
  createdAt: Date;
}

// src/profiles/domain/entities/professional.entity.ts
export class ProfessionalEntity {
  id: string;
  userId: string;
  trades: TradeInfo[];
  description: string;
  status: ProfessionalStatus;
  // ... other fields
}
```

### 3. Guards

```typescript
// JWT Guard - Basic authentication
@UseGuards(JwtAuthGuard)

// Admin Guard - Requires isAdmin: true
@UseGuards(JwtAuthGuard, AdminGuard)

// Professional Guard - Requires hasProfessionalProfile: true
@UseGuards(JwtAuthGuard, ProfessionalGuard)
```

## Profile Activation Flow

### Client Profile

```
User registers
    │
    ▼
POST /api/users/me/client-profile
    │
    ▼
Client record created
hasClientProfile = true
```

### Professional Profile

```
User registers
    │
    ▼
POST /api/professionals/me
    │
    ▼
Professional record created
hasProfessionalProfile = true
status = PENDING_VERIFICATION
    │
    ▼
Admin reviews
    │
    ├──► VERIFIED (can work)
    └──► REJECTED (cannot work)
```

## Advantages

✅ **Flexibility**: One user can be both client and professional
✅ **Simplicity**: Single authentication, multiple capabilities
✅ **Scalability**: Easy to add new profile types
✅ **UX**: Seamless switching between modes
✅ **Data Integrity**: Clear separation of profile data

## API Permissions

| Endpoint | Client | Professional | Admin |
|----------|--------|--------------|-------|
| `GET /professionals` | ✅ | ✅ | ✅ |
| `POST /requests` | ✅ | ❌ | ✅ |
| `GET /requests/available` | ❌ | ✅ | ✅ |
| `POST /requests/:id/interest` | ❌ | ✅ | ❌ |
| `POST /reviews` | ✅ | ❌ | ✅ |
| `GET /admin/*` | ❌ | ❌ | ✅ |

---

*Last Updated: December 2024*
