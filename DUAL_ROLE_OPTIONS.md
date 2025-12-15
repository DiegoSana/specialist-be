# Options for Supporting Dual Role: Client + Professional

## Current Architecture

- **User.role**: Single enum value (CLIENT | PROFESSIONAL | ADMIN)
- **Professional**: Separate entity with 1:1 relationship to User
- **Constraint**: One user can only have ONE role at a time
- **Professional Profile**: Only exists if `user.role === PROFESSIONAL`

## Business Requirement

Allow a user to be **both CLIENT and PROFESSIONAL** simultaneously:
- A user can search and hire professionals (CLIENT functionality)
- The same user can offer professional services (PROFESSIONAL functionality)

---

## Option 1: Remove Role Dependency from Professional Profile ⭐ RECOMMENDED

### Approach
- Keep `User.role` enum for backward compatibility
- Remove role validation when creating Professional profile
- Allow any user (including CLIENT) to create a Professional profile
- Check for Professional profile existence instead of role

### Implementation

**Schema Changes:**
```prisma
model User {
  // ... existing fields
  role             UserRole      @default(CLIENT)  // Keep for backward compat
  professional     Professional?  // Can exist regardless of role
}

// No changes to Professional model needed
```

**Code Changes:**
```typescript
// Before
canCreateProfessionalProfile(): boolean {
  return this.role === UserRole.PROFESSIONAL && this.isActive();
}

// After
canCreateProfessionalProfile(): boolean {
  return this.isActive(); // Any active user can create profile
}

// Check capabilities instead of role
hasProfessionalProfile(): boolean {
  return this.professional !== null;
}

canCreateRequest(): boolean {
  return this.isActive(); // Any active user can create requests
}
```

**Guards:**
```typescript
// Instead of checking role, check profile existence
@UseGuards(JwtAuthGuard, HasProfessionalProfileGuard)
@Get('professionals/me/profile')
async getMyProfile() { ... }
```

### Pros ✅
- **Minimal changes**: No schema migration needed
- **Backward compatible**: Existing code continues to work
- **Flexible**: User can be client, professional, or both
- **Simple logic**: Check profile existence, not role
- **No breaking changes**: Existing users unaffected

### Cons ❌
- **Role field becomes less meaningful**: Still used for display/analytics
- **Potential confusion**: Role might not match actual capabilities
- **Migration needed**: Update all role checks to capability checks

### Migration Effort: **LOW** ⭐
- Update `UserEntity` methods
- Update guards to check profile existence
- Update service validations
- No database migration required

---

## Option 2: Multiple Roles Array

### Approach
- Change `User.role` from enum to array of roles
- Store as JSON array or separate table
- User can have multiple roles: `[CLIENT, PROFESSIONAL]`

### Implementation

**Schema Changes:**
```prisma
// Option 2A: JSON Array
model User {
  roles            Json           @default(["CLIENT"])  // Array of roles
  // OR
}

// Option 2B: Junction Table
model User {
  // ... existing fields
  userRoles        UserRole[]
}

model UserRole {
  id        String   @id @default(uuid())
  userId    String
  role      UserRole
  user      User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, role])
  @@map("user_roles")
}
```

**Code Changes:**
```typescript
// UserEntity
hasRole(role: UserRole): boolean {
  return this.roles.includes(role);
}

isClient(): boolean {
  return this.hasRole(UserRole.CLIENT);
}

isProfessional(): boolean {
  return this.hasRole(UserRole.PROFESSIONAL);
}

canCreateProfessionalProfile(): boolean {
  return this.isActive() && !this.hasRole(UserRole.PROFESSIONAL);
}
```

### Pros ✅
- **Explicit roles**: Clear what roles a user has
- **Scalable**: Easy to add more roles
- **Flexible**: Can have any combination
- **Queryable**: Can filter users by role

### Cons ❌
- **Breaking change**: Requires migration of all existing data
- **More complex**: Need to handle role arrays everywhere
- **Overhead**: More complex queries and validations
- **Migration complexity**: Convert single role to array

### Migration Effort: **HIGH** 🔴
- Database migration (enum → array/table)
- Update all role checks
- Migrate existing data
- Update all queries
- Update guards and services

---

## Option 3: Capabilities/Permissions System

### Approach
- Separate roles from capabilities
- User has capabilities: `canBeClient`, `canBeProfessional`, `canBeAdmin`
- Role becomes a computed property or display label

### Implementation

**Schema Changes:**
```prisma
model User {
  // ... existing fields
  role             UserRole      @default(CLIENT)  // Display/legacy
  isClient         Boolean       @default(true)
  isProfessional   Boolean       @default(false)
  isAdmin          Boolean       @default(false)
  professional     Professional?
}
```

**Code Changes:**
```typescript
// UserEntity
canCreateProfessionalProfile(): boolean {
  return this.isActive() && !this.isProfessional;
}

canCreateRequest(): boolean {
  return this.isActive() && this.isClient;
}

hasProfessionalProfile(): boolean {
  return this.professional !== null;
}

// Computed role for display
getPrimaryRole(): UserRole {
  if (this.isAdmin) return UserRole.ADMIN;
  if (this.isProfessional) return UserRole.PROFESSIONAL;
  return UserRole.CLIENT;
}
```

### Pros ✅
- **Explicit capabilities**: Clear what user can do
- **Flexible**: Easy to add new capabilities
- **Backward compatible**: Can keep role field
- **Clear separation**: Roles vs capabilities

### Cons ❌
- **More fields**: Additional boolean fields
- **Redundancy**: Role and capabilities might diverge
- **Migration needed**: Add new fields and migrate data
- **More complex**: Need to maintain both systems

### Migration Effort: **MEDIUM** 🟡
- Add boolean fields to schema
- Migrate existing data
- Update entity and services
- Update guards

---

## Option 4: Role Hierarchy with Inheritance

### Approach
- Define role hierarchy: CLIENT < PROFESSIONAL < ADMIN
- Professional automatically has CLIENT capabilities
- Check: `user.role >= PROFESSIONAL` means can do both

### Implementation

**Code Changes:**
```typescript
// UserEntity
canCreateRequest(): boolean {
  // CLIENT or PROFESSIONAL can create requests
  return this.isActive() && 
    (this.role === UserRole.CLIENT || this.role === UserRole.PROFESSIONAL);
}

canCreateProfessionalProfile(): boolean {
  return this.isActive() && this.role === UserRole.PROFESSIONAL;
}

// But allow CLIENT to also create profile
canCreateProfessionalProfile(): boolean {
  return this.isActive(); // Any active user
}
```

### Pros ✅
- **Simple**: Minimal code changes
- **No schema changes**: Works with current structure
- **Intuitive**: Professional "includes" client capabilities

### Cons ❌
- **Not truly dual**: Still single role, just with inherited permissions
- **Limitation**: Can't distinguish "professional who is also client" vs "just professional"
- **Confusing**: Role doesn't reflect actual capabilities

### Migration Effort: **LOW** ⭐
- Update permission checks only
- No schema changes

---

## Option 5: Separate Client and Professional Entities

### Approach
- Create separate `ClientProfile` entity
- User can have both `ClientProfile` and `ProfessionalProfile`
- Role becomes computed or removed

### Implementation

**Schema Changes:**
```prisma
model User {
  // ... existing fields
  role             UserRole?     // Optional, for legacy
  clientProfile    ClientProfile?
  professional     Professional?
}

model ClientProfile {
  id              String   @id @default(uuid())
  userId          String   @unique
  preferences     Json?
  savedProfessionals String[]  // Favorites
  user            User     @relation(fields: [userId], references: [id])
  
  @@map("client_profiles")
}
```

### Pros ✅
- **Clear separation**: Explicit profiles for each capability
- **Extensible**: Can add client-specific data
- **Flexible**: User can have one, both, or neither

### Cons ❌
- **Over-engineering**: Client profile might be unnecessary
- **More complexity**: Additional entity to manage
- **Migration needed**: Create new entity and migrate

### Migration Effort: **MEDIUM** 🟡
- Create ClientProfile entity
- Migrate data if needed
- Update services

---

## Recommendation: Option 1 ⭐

### Why Option 1 is Best

1. **Minimal Impact**: No database migration needed
2. **Backward Compatible**: Existing code continues working
3. **Simple Logic**: Check profile existence, not role
4. **Flexible**: User can be client, professional, or both
5. **Quick to Implement**: Changes are mostly in business logic

### Implementation Steps

1. **Update UserEntity methods:**
   ```typescript
   hasProfessionalProfile(): boolean {
     return this.professional !== null;
   }
   
   canCreateProfessionalProfile(): boolean {
     return this.isActive();
   }
   
   canCreateRequest(): boolean {
     return this.isActive();
   }
   ```

2. **Update Guards:**
   - Create `HasProfessionalProfileGuard` instead of `ProfessionalGuard`
   - Check profile existence, not role

3. **Update Services:**
   - Remove role checks when creating professional profile
   - Check profile existence for professional endpoints

4. **Update Frontend:**
   - Show "Become Professional" button for all users
   - Check if user has professional profile, not role

### Migration Path

```typescript
// Phase 1: Make role optional for professional profile
// - Remove role validation in createProfile
// - Update guards to check profile existence

// Phase 2: Update all role checks to capability checks
// - Replace isProfessional() with hasProfessionalProfile()
// - Update all guards and services

// Phase 3: (Optional) Remove role field or make it computed
// - Keep for analytics/display
// - Or compute from profile existence
```

---

## Comparison Table

| Option | Migration Effort | Breaking Changes | Flexibility | Complexity |
|--------|-----------------|------------------|-------------|------------|
| **Option 1** | ⭐ LOW | ❌ None | ✅ High | ⭐ Low |
| Option 2 | 🔴 HIGH | ✅ Yes | ✅ High | 🔴 High |
| Option 3 | 🟡 MEDIUM | ⚠️ Some | ✅ High | 🟡 Medium |
| Option 4 | ⭐ LOW | ❌ None | ⚠️ Limited | ⭐ Low |
| Option 5 | 🟡 MEDIUM | ⚠️ Some | ✅ High | 🟡 Medium |

---

## Decision Matrix

Choose **Option 1** if:
- ✅ You want minimal changes
- ✅ You need backward compatibility
- ✅ You want quick implementation
- ✅ Profile existence is more important than role

Choose **Option 2** if:
- ✅ You need explicit role tracking
- ✅ You plan to add many more roles
- ✅ You need complex role-based queries
- ✅ You can afford breaking changes

Choose **Option 3** if:
- ✅ You want explicit capabilities
- ✅ You need fine-grained permissions
- ✅ You want to separate roles from capabilities

---

## Next Steps

1. Review this document with the team
2. Decide on the approach
3. Create implementation plan
4. Update architecture documentation
5. Implement changes incrementally

