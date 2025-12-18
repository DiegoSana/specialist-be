# Domain Model - Specialist

> Updated December 2024 - Reflects current bounded contexts architecture

## Bounded Contexts

### 1. Identity Context
**Purpose**: Manages user identity and authentication.

**Aggregate Root**: `User`

**Entities**:
- `User` - Base user with authentication data

**Key Fields**:
- email, password (optional for OAuth)
- firstName, lastName, phone
- authProvider: LOCAL | GOOGLE | FACEBOOK
- hasClientProfile, hasProfessionalProfile (flags)
- isAdmin, status

---

### 2. Profiles Context
**Purpose**: Manages business profiles (Client and Professional).

**Aggregate Roots**:
- `Client` - Client profile (can create requests)
- `Professional` - Professional profile (can receive work)
- `Trade` - Service category

**Key Relationships**:
- User 1:0..1 Client
- User 1:0..1 Professional
- Professional N:M Trade

---

### 3. Requests Context
**Purpose**: Manages service requests lifecycle.

**Aggregate Roots**:
- `Request` - Service request (public or direct)
- `RequestInterest` - Professional interest in public request

**Request Types**:
- **Direct** (isPublic: false) - Client → specific Professional
- **Public** (isPublic: true) - Client → any Professional (via interests)

---

### 4. Reputation Context
**Purpose**: Reviews and ratings system.

**Aggregate Root**: `Review`

**Rules**:
- Only after Request is DONE
- One Review per Request
- Updates Professional's averageRating

---

## Domain Model Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      IDENTITY CONTEXT                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User                                                        │
│  ├── id: UUID                                               │
│  ├── email: string (unique)                                 │
│  ├── password: string | null (OAuth users)                  │
│  ├── firstName, lastName: string                            │
│  ├── phone: string | null                                   │
│  ├── authProvider: LOCAL | GOOGLE | FACEBOOK                │
│  ├── hasClientProfile: boolean                              │
│  ├── hasProfessionalProfile: boolean                        │
│  ├── isAdmin: boolean                                       │
│  └── status: PENDING | ACTIVE | SUSPENDED | BANNED          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │ 1:0..1        │               │ 1:0..1
           ▼               │               ▼
┌─────────────────────────────────────────────────────────────┐
│                      PROFILES CONTEXT                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client                    Professional                      │
│  ├── id: UUID              ├── id: UUID                     │
│  ├── userId: FK            ├── userId: FK                   │
│  └── createdAt             ├── trades: Trade[]              │
│                            ├── description: string          │
│       Trade                ├── experienceYears: number      │
│       ├── id: UUID         ├── status: ProfessionalStatus   │
│       ├── name             ├── city, zone, address          │
│       ├── category         ├── whatsapp, website            │
│       └── description      ├── gallery: string[]            │
│                            ├── averageRating: number        │
│                            └── totalReviews: number         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
           │                               │
           │ creates                       │ receives
           ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      REQUESTS CONTEXT                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Request                                                     │
│  ├── id: UUID                                               │
│  ├── clientId: FK → Client                                  │
│  ├── professionalId: FK → Professional | null               │
│  ├── tradeId: FK → Trade | null                             │
│  ├── isPublic: boolean                                      │
│  ├── description: string                                     │
│  ├── address, availability                                   │
│  ├── photos: string[]                                        │
│  ├── status: PENDING | ACCEPTED | IN_PROGRESS | DONE | CANCEL│
│  ├── quoteAmount, quoteNotes                                │
│  └── createdAt, updatedAt                                   │
│                                                              │
│  RequestInterest (only for public requests)                 │
│  ├── id: UUID                                               │
│  ├── requestId: FK → Request                                │
│  ├── professionalId: FK → Professional                      │
│  ├── message: string | null                                 │
│  └── createdAt                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ after DONE
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     REPUTATION CONTEXT                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Review                                                      │
│  ├── id: UUID                                               │
│  ├── requestId: FK → Request                                │
│  ├── reviewerId: FK → User                                  │
│  ├── professionalId: FK → Professional                      │
│  ├── rating: 1-5                                            │
│  ├── comment: string                                        │
│  └── createdAt, updatedAt                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Business Rules

### Identity
- Email must be unique
- OAuth users may not have password
- User can have 0, 1, or both profiles (Client AND Professional)

### Profiles
- Professional must have at least one Trade
- Professional status: PENDING_VERIFICATION → VERIFIED | REJECTED
- Only VERIFIED professionals appear in search

### Requests
- Direct Request: professionalId required, tradeId optional
- Public Request: tradeId required, professionalId null initially
- Only client can accept quote
- Only assigned professional can update status

### Reputation
- Review only after Request status = DONE
- One Review per Request
- Review updates Professional's averageRating

## Module Structure

```
src/
├── identity/           # User auth & management
├── profiles/           # Client, Professional, Trade
├── requests/           # Request, RequestInterest
├── reputation/         # Review
├── storage/            # File management
├── admin/              # Admin operations
├── contact/            # Contact requests
├── health/             # Health checks
└── shared/             # Common utilities
```

---

*Last Updated: December 2024*
