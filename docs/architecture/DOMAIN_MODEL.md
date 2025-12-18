# Domain Model - Especialistas

## Bounded Contexts

### 1. User Management Context
**Purpose**: Manages user identity, authentication, and roles.

**Aggregate Root**: `User`

**Entities**:
- `User` - Base user entity with role (CLIENT | PROFESSIONAL | ADMIN)

**Value Objects**:
- `Email`
- `Phone`

**Domain Services**:
- `UserRegistrationService`
- `AuthenticationService`

---

### 2. Service Context
**Purpose**: Manages professionals, trades, and service requests.

**Aggregate Roots**:
- `Professional` - Professional profile
- `Trade` - Service category (Electrician, Plumber, etc.)
- `Request` - Service request from client to professional

**Entities**:
- `Professional` - Belongs to User and Trade
- `Trade` - Service category
- `Request` - Service request

**Value Objects**:
- `Zone` (location)
- `ServiceDescription`

**Domain Services**:
- `ProfessionalRegistrationService`
- `RequestManagementService`

---

### 3. Reputation Context
**Purpose**: Manages reviews, ratings, and feedback.

**Aggregate Root**: `Review`

**Entities**:
- `Review` - Links User (reviewer) with Professional

**Value Objects**:
- `Rating` (1-5)

**Domain Services**:
- `RatingCalculationService`

---

## Domain Model Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              USER MANAGEMENT CONTEXT                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User (Aggregate Root)                                      │
│  ├── id: UUID                                               │
│  ├── email: Email (VO)                                      │
│  ├── password: string                                       │
│  ├── firstName: string                                       │
│  ├── lastName: string                                       │
│  ├── phone: Phone? (VO)                                      │
│  ├── role: 'CLIENT' | 'PROFESSIONAL' | 'ADMIN'             │
│  ├── status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED'  │
│  └── createdAt, updatedAt                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ 1:1 (if role = PROFESSIONAL)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE CONTEXT                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Trade (Aggregate Root)                                      │
│  ├── id: UUID                                               │
│  ├── name: string (e.g., "Electrician", "Plumber")         │
│  ├── category?: string                                       │
│  └── createdAt, updatedAt                                    │
│                                                              │
│  Professional (Aggregate Root)                              │
│  ├── id: UUID                                               │
│  ├── userId: UUID (FK to User)                              │
│  ├── tradeId: UUID (FK to Trade)                            │
│  ├── description?: string                                    │
│  ├── experienceYears?: number                                │
│  ├── zone?: string                                          │
│  ├── active: boolean                                        │
│  ├── averageRating: number                                  │
│  ├── totalReviews: number                                   │
│  └── createdAt, updatedAt                                   │
│                                                              │
│  Request (Aggregate Root)                                   │
│  ├── id: UUID                                               │
│  ├── clientId: UUID (FK to User)                            │
│  ├── professionalId: UUID (FK to Professional)              │
│  ├── description: string                                     │
│  ├── status: 'PENDING' | 'ACCEPTED' | 'DONE' | 'CANCELLED'│
│  └── createdAt, updatedAt                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ N:1
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  REPUTATION CONTEXT                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Review (Aggregate Root)                                     │
│  ├── id: UUID                                               │
│  ├── reviewerId: UUID (FK to User)                         │
│  ├── professionalId: UUID (FK to Professional)              │
│  ├── requestId?: UUID (FK to Request) - optional           │
│  ├── rating: Rating (VO) - 1 to 5                           │
│  ├── comment?: string                                        │
│  └── createdAt, updatedAt                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Business Rules

### User Management
- A `User` with role `PROFESSIONAL` must have exactly one `Professional` profile
- A `User` with role `CLIENT` cannot have a `Professional` profile
- A `User` with role `ADMIN` has elevated permissions but no special entity

### Service Context
- A `Professional` must belong to at least one `Trade`
- A `Request` can only be accepted by one `Professional`
- A `Request` must have a `clientId` (User with role CLIENT)
- A `Request` must have a `professionalId` (Professional)

### Reputation Context
- A `Review` can only be created if there's a completed `Request` between the parties (optional for MVP)
- A `Review` cannot be created by a Professional reviewing themselves
- A `Review` rating must be between 1 and 5
- The `averageRating` of a `Professional` is calculated from all `Review` ratings

## Context Boundaries

Each bounded context:
- Has its own domain entities
- Has its own repositories (interfaces in domain, implementations in infrastructure)
- Has its own application services
- Can communicate with other contexts through application services (not directly)

## Module Structure

```
src/
├── user-management/          # User Management Context
│   ├── domain/
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── value-objects/
│   │   │   ├── email.vo.ts
│   │   │   └── phone.vo.ts
│   │   └── repositories/
│   │       └── user.repository.ts
│   ├── application/
│   │   ├── services/
│   │   │   ├── user-registration.service.ts
│   │   │   └── authentication.service.ts
│   │   └── dto/
│   └── infrastructure/
│       └── repositories/
│           └── prisma-user.repository.ts
│
├── service/                   # Service Context
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── professional.entity.ts
│   │   │   ├── trade.entity.ts
│   │   │   └── request.entity.ts
│   │   └── repositories/
│   │       ├── professional.repository.ts
│   │       ├── trade.repository.ts
│   │       └── request.repository.ts
│   ├── application/
│   └── infrastructure/
│
└── reputation/                # Reputation Context
    ├── domain/
    │   ├── entities/
    │   │   └── review.entity.ts
    │   ├── value-objects/
    │   │   └── rating.vo.ts
    │   └── repositories/
    │       └── review.repository.ts
    ├── application/
    └── infrastructure/
```

