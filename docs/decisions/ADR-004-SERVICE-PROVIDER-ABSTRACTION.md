# ADR-004: Service Provider Abstraction

## Status
**Accepted** - January 2026

## Context

The Specialist platform initially supported only individual professionals as service providers. As the platform evolved, a new requirement emerged: **companies** should also be able to offer services, express interest in requests, receive reviews, and build reputation.

The existing architecture tightly coupled several domain entities to `Professional`:

- `Request.professionalId` - Direct assignment to professionals
- `RequestInterest.professionalId` - Interest expression linked to professionals
- `Review.professionalId` - Reviews targeted at professionals

This coupling made it difficult to add company support without duplicating code or creating inconsistent patterns.

## Decision

We introduce a **ServiceProvider** abstraction as a polymorphic parent entity for both `Professional` and `Company`.

### Domain Model

```
┌─────────────────────────────────────┐
│          ServiceProvider            │
├─────────────────────────────────────┤
│ id: UUID                            │
│ type: PROFESSIONAL | COMPANY        │
│ averageRating: Decimal              │
│ reviewCount: Int                    │
└───────────────┬─────────────────────┘
                │
        ┌───────┴───────┐
        │               │
┌───────▼─────┐ ┌───────▼─────┐
│ Professional │ │   Company   │
├─────────────┤ ├─────────────┤
│ displayName │ │ companyName │
│ city        │ │ legalName   │
│ status      │ │ taxId       │
│ trades[]    │ │ trades[]    │
│ ...         │ │ status      │
└─────────────┘ └─────────────┘
```

### Key Design Decisions

#### 1. ServiceProvider owns shared attributes
- `averageRating` and `reviewCount` are stored in `ServiceProvider`
- Both `Professional` and `Company` inherit these via their relation
- This enables unified rating/review aggregation

#### 2. Request assignment uses ServiceProvider
- `Request.providerId` → `ServiceProvider.id`
- Both professionals and companies can be assigned to requests
- The `Request` entity doesn't need to know the specific provider type

#### 3. RequestInterest links to ServiceProvider
- `RequestInterest.serviceProviderId` → `ServiceProvider.id`
- Both professionals and companies can express interest
- Interest deduplication works across provider types

#### 4. Reviews target ServiceProvider
- `Review.serviceProviderId` → `ServiceProvider.id`
- Rating calculations are unified
- Query patterns remain simple

### Database Schema

```prisma
model ServiceProvider {
  id            String       @id @default(uuid())
  type          ProviderType
  averageRating Decimal      @default(0)
  reviewCount   Int          @default(0)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  professional  Professional?
  company       Company?
  requests      Request[]
  interests     RequestInterest[]
  reviews       Review[]

  @@map("service_providers")
}

enum ProviderType {
  PROFESSIONAL
  COMPANY
}
```

### Migration Strategy

1. **Phase 1**: Create `ServiceProvider` table
2. **Phase 2**: Create `ServiceProvider` records for existing professionals
3. **Phase 3**: Add `serviceProviderId` to `Professional` table
4. **Phase 4**: Migrate `Request.professionalId` to `Request.providerId`
5. **Phase 5**: Migrate `RequestInterest.professionalId` to `RequestInterest.serviceProviderId`
6. **Phase 6**: Migrate `Review.professionalId` to `Review.serviceProviderId`
7. **Phase 7**: Create `Company` model with `serviceProviderId`

## Consequences

### Positive

- **Single source of truth** for ratings across provider types
- **Unified interest/assignment flow** - no code duplication
- **Extensible** - easy to add new provider types (e.g., franchises)
- **Simpler queries** - filter by ServiceProvider without type checks
- **Consistent API** - clients don't need to handle different endpoints

### Negative

- **Additional join** required when fetching provider details
- **Migration complexity** - existing data needs careful transformation
- **Potential confusion** - developers must understand the abstraction

### Neutral

- Tests need updating to use `serviceProviderId`
- Event payloads include both provider-agnostic and legacy fields
- Frontend needs to handle `providerType` discriminator

## Alternatives Considered

### 1. Separate endpoints for companies
- Create `/company-requests`, `/company-interests`, etc.
- **Rejected**: Too much code duplication, inconsistent UX

### 2. Union type in Request
- Store both `professionalId` and `companyId` in Request
- **Rejected**: Violates normalization, complex validation

### 3. Generic provider table with JSON
- Store provider-specific data in JSON column
- **Rejected**: Loses type safety, harder to query

## References

- [Martin Fowler - Single Table Inheritance](https://www.martinfowler.com/eaaCatalog/singleTableInheritance.html)
- [Prisma - Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
- [DDD - Aggregate Roots](https://www.domainlanguage.com/ddd/reference/)

## Related ADRs

- [ADR-001: Dual Profile Architecture](./ADR-001-DUAL-PROFILE-ARCHITECTURE.md)
- [ADR-002: Repository Encapsulation](./ADR-002-REPOSITORY-ENCAPSULATION.md)

