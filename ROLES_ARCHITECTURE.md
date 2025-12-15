# Roles Architecture - Especialistas API

## Approach: Hybrid with Base Entity + Composition

### Design Decision

A **hybrid approach** has been chosen that combines:

1. **Unified Base Entity (User)**: All users share authentication and basic data
2. **Role-based Composition**: Each role has its own specialized entities and services
3. **Specific Guards**: Granular access control by role

### Advantages of this Approach

✅ **Simplicity**: Single user table, easy to maintain
✅ **Flexibility**: A user can change roles without complex migration
✅ **Separation of Concerns**: Each module handles its specific domain
✅ **Scalability**: Easy to add new roles or permissions
✅ **DDD Compliant**: Maintains domain cohesion

### Role Structure

```
User (Base Entity)
├── role: UserRole enum
├── status: UserStatus
└── Basic data (email, password, firstName, lastName, phone)

┌─────────────────────────────────────────────────────────┐
│                    ROLES                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ADMIN                                                   │
│  ├── Full system access                                 │
│  ├── User moderation                                    │
│  └── Professional verification                          │
│                                                          │
│  PROFESSIONAL                                           │
│  ├── User base                                          │
│  └── ProfessionalProfile (composition)                 │
│      ├── Specialties                                   │
│      ├── Experience                                    │
│      ├── Ratings                                       │
│      └── Verification status                           │
│                                                          │
│  CLIENT (USER)                                          │
│  ├── User base                                          │
│  └── Basic functionalities                             │
│      ├── Search professionals                          │
│      ├── Create reviews                                │
│      └── Contact professionals                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Implementation

#### 1. Base Entity (UserEntity)

```typescript
// src/user-management/domain/entities/user.entity.ts
export class UserEntity {
  // Data shared by all roles
  role: UserRole;
  status: UserStatus;
  
  // Verification methods
  isAdmin(): boolean
  isProfessional(): boolean
  isClient(): boolean
}
```

#### 2. Value Objects for Roles

```typescript
// src/shared/domain/value-objects/user-role.vo.ts
export class UserRoleVO {
  // Business logic specific to role
  canAccessAdminPanel(): boolean
  canCreateProfessionalProfile(): boolean
  canReviewProfessionals(): boolean
}
```

#### 3. Specific Guards

```typescript
// Specialized guards
- AdminGuard: Only admins
- ProfessionalGuard: Only professionals
- RolesGuard: Multiple roles with @Roles() decorator
```

#### 4. Module-based Composition

```
user-management/     → User base (all roles)
service/             → Professionals (User + ProfessionalProfile)
admin/               → Administrators (User base with permissions)
```

### Access Control

#### Option 1: Specific Guards (Recommended)

```typescript
@UseGuards(JwtAuthGuard, AdminGuard)
@Get('admin/users')
async getUsers() { ... }
```

#### Option 2: Roles Decorator

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PROFESSIONAL)
@Get('special-endpoint')
async specialEndpoint() { ... }
```

### Comparison with Other Approaches

#### ❌ Approach 1: Separate Entities
```typescript
Admin extends User
Professional extends User
Client extends User
```
**Problems:**
- Code duplication
- Complex migrations
- Difficult to change roles

#### ❌ Approach 2: Separate Roles Table
```sql
users table
roles table
user_roles junction table
```
**Problems:**
- Unnecessary overhead for 3 fixed roles
- More complex queries
- Over-engineering

#### ✅ Chosen Approach: Enum + Composition
```typescript
User { role: UserRole }
ProfessionalProfile { userId }
```
**Advantages:**
- Simple and direct
- Easy to understand
- Scalable if you need more roles
- DDD compliant

### Use Cases

#### 1. User becomes Professional
```typescript
// Change role
user.role = UserRole.PROFESSIONAL
// Create professional profile
professionalProfile = createProfile(userId, data)
```

#### 2. Professional needs Admin permissions
```typescript
// Change role (requires validation)
if (canPromoteToAdmin(user)) {
  user.role = UserRole.ADMIN
}
```

#### 3. Verify Permissions
```typescript
// In services
if (!user.isProfessional()) {
  throw new ForbiddenException()
}

// In guards
@UseGuards(JwtAuthGuard, ProfessionalGuard)
```

### Future Migrations

If in the future you need:
- **More roles**: Add to `UserRole` enum
- **Granular permissions**: Use `RolesGuard` with `@Roles()` decorator
- **Complex role logic**: Create specific Domain Services
- **Temporary roles**: Add `temporaryRole` field or `role_history` table

### Recommendations

1. ✅ **Keep User as base entity** - All share authentication
2. ✅ **Use composition for specific data** - Separate ProfessionalProfile
3. ✅ **Specific guards for access control** - Clearer and more maintainable
4. ✅ **Value Objects for role logic** - Encapsulates business rules
5. ✅ **Avoid inheritance** - Composition is more flexible in DDD

### Complete Example

```typescript
// Controller
@Controller('service')
@UseGuards(JwtAuthGuard)
export class ServiceController {
  
  @Get('professionals/me/profile')
  @UseGuards(ProfessionalGuard) // Only professionals
  async getMyProfile(@CurrentUser() user: UserEntity) {
    return this.service.getProfile(user.id);
  }
  
  @Get('professionals')
  @Public() // Public
  async findAll() {
    return this.service.findAll();
  }
}
```

This approach provides the best combination of simplicity, flexibility, and maintainability following DDD principles.
