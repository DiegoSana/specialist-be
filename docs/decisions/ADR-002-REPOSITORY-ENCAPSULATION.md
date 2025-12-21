# ADR-002: Repository Encapsulation in Bounded Contexts

## Status
**Accepted** - December 2024

## Context

In our DDD-based architecture, we initially exported repositories from modules to allow other bounded contexts to access data directly. This led to:

1. **Tight coupling**: Contexts depended on internal implementation details of other contexts
2. **Bypassed business logic**: Other contexts could skip validation and rules in services
3. **Maintenance burden**: Changes to a repository interface affected multiple contexts
4. **Testing complexity**: Tests needed to mock repositories from other contexts

### Example of the Problem

```typescript
// ❌ Before: AuthenticationService directly using ClientRepository
@Injectable()
export class AuthenticationService {
  constructor(
    @Inject(CLIENT_REPOSITORY) private readonly clientRepository: ClientRepository,
  ) {}

  async register(dto: RegisterDto) {
    // Bypasses any business logic in ClientService
    await this.clientRepository.create({ userId: user.id });
  }
}
```

## Decision

**Repositories are internal to their bounded context and must NOT be exported.**

Cross-context communication must happen through Services, which act as the public API of each bounded context.

### Key Changes

1. **Removed repository exports from modules:**
   ```typescript
   // ProfilesModule
   exports: [
     ClientService,
     ProfessionalService,
     TradeService,
     // ❌ Removed: CLIENT_REPOSITORY, PROFESSIONAL_REPOSITORY, TRADE_REPOSITORY
   ]
   ```

2. **Created UserService in Identity context:**
   ```typescript
   @Injectable()
   export class UserService {
     async findById(userId: string, includeProfiles = false): Promise<UserEntity | null>;
     async findByIdOrFail(userId: string, includeProfiles = false): Promise<UserEntity>;
     async update(userId: string, data: Partial<UserEntity>): Promise<UserEntity>;
   }
   ```

3. **Updated cross-context dependencies to use services:**
   ```typescript
   // ✅ After: AuthenticationService using ClientService
   @Injectable()
   export class AuthenticationService {
     constructor(
       private readonly clientService: ClientService,
     ) {}

     async register(dto: RegisterDto) {
       // Uses service method with proper business logic
       await this.clientService.activateClientProfile(user.id);
     }
   }
   ```

## Consequences

### Positive

- **Encapsulation**: Implementation details stay internal to each context
- **Business logic enforcement**: All operations go through services with validation
- **Loose coupling**: Contexts depend on stable service interfaces, not repositories
- **Easier testing**: Mock services instead of repositories
- **Clear boundaries**: Obvious what each context exposes

### Negative

- **More boilerplate**: Need to create service methods for cross-context operations
- **Potential performance**: Extra layer of abstraction (negligible in practice)
- **Circular dependency risk**: Must use `forwardRef()` for bidirectional dependencies

## Architectural Fitness Function

To prevent regression, an architectural test validates that no service imports repositories from other contexts:

```typescript
// src/__tests__/architecture.spec.ts
describe('Architecture', () => {
  it('should not import repositories from other contexts', () => {
    // Test validates import patterns
  });
});
```

## Affected Services

| Service | Before | After |
|---------|--------|-------|
| AuthenticationService | ClientRepository | ClientService |
| RequestService | UserRepository, ProfessionalRepository | UserService, ProfessionalService |
| RequestInterestService | ProfessionalRepository | ProfessionalService |
| ClientService | UserRepository | UserService |
| ReviewService | UserRepository, ProfessionalRepository, RequestRepository | Services |
| AdminService | UserRepository, ProfessionalRepository | Services |
| FileStorageService | RequestRepository, ProfessionalRepository | Services |

## References

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Fitness Functions in Evolutionary Architecture](https://www.thoughtworks.com/insights/articles/fitness-function-driven-development)

