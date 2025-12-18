# Option 5: Complete Implementation Example

## Schema Changes

### Prisma Schema

```prisma
model User {
  id               String        @id @default(uuid())
  email            String        @unique
  password         String
  firstName        String
  lastName         String
  phone            String?
  role             UserRole?     // Optional, for legacy/analytics
  status           UserStatus    @default(PENDING)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  
  // Explicit profiles
  clientProfile    ClientProfile?
  professional     Professional?
  
  // Relations
  requests         Request[]     @relation("Client")
  reviewsGiven     Review[]      @relation("Reviewer")
  contacts         Contact[]     @relation("FromUser")
  contactsReceived Contact[]     @relation("ToUser")

  @@map("users")
}

model ClientProfile {
  id                  String   @id @default(uuid())
  userId              String   @unique
  preferences         Json?    // Client-specific preferences
  savedProfessionals  String[] // Favorite professionals IDs
  searchHistory       Json?    // Search preferences/history
  notificationSettings Json?   // Notification preferences
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("client_profiles")
}

// Professional model stays the same
model Professional {
  // ... existing fields unchanged
  userId          String             @unique
  // ... rest unchanged
}
```

---

## Domain Layer

### ClientProfileEntity

```typescript
// src/service/domain/entities/client-profile.entity.ts
import { ClientPreferences, NotificationSettings } from '../value-objects';

export class ClientProfileEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly preferences: ClientPreferences | null,
    public readonly savedProfessionals: string[],
    public readonly searchHistory: SearchHistory | null,
    public readonly notificationSettings: NotificationSettings | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  hasSavedProfessional(professionalId: string): boolean {
    return this.savedProfessionals.includes(professionalId);
  }

  addSavedProfessional(professionalId: string): ClientProfileEntity {
    if (this.hasSavedProfessional(professionalId)) {
      return this; // Already saved
    }
    return new ClientProfileEntity(
      this.id,
      this.userId,
      this.preferences,
      [...this.savedProfessionals, professionalId],
      this.searchHistory,
      this.notificationSettings,
      this.createdAt,
      this.updatedAt,
    );
  }

  removeSavedProfessional(professionalId: string): ClientProfileEntity {
    return new ClientProfileEntity(
      this.id,
      this.userId,
      this.preferences,
      this.savedProfessionals.filter(id => id !== professionalId),
      this.searchHistory,
      this.notificationSettings,
      this.createdAt,
      this.updatedAt,
    );
  }

  updatePreferences(preferences: ClientPreferences): ClientProfileEntity {
    return new ClientProfileEntity(
      this.id,
      this.userId,
      preferences,
      this.savedProfessionals,
      this.searchHistory,
      this.notificationSettings,
      this.createdAt,
      this.updatedAt,
    );
  }
}
```

### Updated UserEntity

```typescript
// src/user-management/domain/entities/user.entity.ts
import { UserRole, UserStatus } from '@prisma/client';
import { ClientProfileEntity } from '../../../service/domain/entities/client-profile.entity';
import { ProfessionalEntity } from '../../../service/domain/entities/professional.entity';

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly password: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly phone: string | null,
    public readonly role: UserRole | null,
    public readonly status: UserStatus,
    public readonly clientProfile: ClientProfileEntity | null,
    public readonly professional: ProfessionalEntity | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  // Explicit capability checks
  hasClientProfile(): boolean {
    return this.clientProfile !== null;
  }

  hasProfessionalProfile(): boolean {
    return this.professional !== null;
  }

  // Permission checks
  canCreateRequest(): boolean {
    return this.isActive() && this.hasClientProfile();
  }

  canCreateProfessionalProfile(): boolean {
    return this.isActive() && !this.hasProfessionalProfile();
  }

  canCreateClientProfile(): boolean {
    return this.isActive() && !this.hasClientProfile();
  }

  canManageProfessionalProfile(): boolean {
    return this.hasProfessionalProfile();
  }

  canManageClientProfile(): boolean {
    return this.hasClientProfile();
  }

  // Computed roles for display/analytics
  getEffectiveRoles(): UserRole[] {
    const roles: UserRole[] = [];
    if (this.hasClientProfile()) roles.push(UserRole.CLIENT);
    if (this.hasProfessionalProfile()) roles.push(UserRole.PROFESSIONAL);
    if (this.role === UserRole.ADMIN) roles.push(UserRole.ADMIN);
    return roles;
  }

  getPrimaryRole(): UserRole {
    if (this.role === UserRole.ADMIN) return UserRole.ADMIN;
    if (this.hasProfessionalProfile()) return UserRole.PROFESSIONAL;
    if (this.hasClientProfile()) return UserRole.CLIENT;
    return UserRole.CLIENT; // Default
  }

  // Legacy methods for backward compatibility
  isClient(): boolean {
    return this.hasClientProfile();
  }

  isProfessional(): boolean {
    return this.hasProfessionalProfile();
  }

  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }
}
```

---

## Repository Layer

### ClientProfileRepository Interface

```typescript
// src/service/domain/repositories/client-profile.repository.ts
import { ClientProfileEntity } from '../entities/client-profile.entity';
import { ClientPreferences } from '../value-objects';

export interface ClientProfileRepository {
  findByUserId(userId: string): Promise<ClientProfileEntity | null>;
  findById(id: string): Promise<ClientProfileEntity | null>;
  create(data: {
    userId: string;
    preferences?: ClientPreferences;
    savedProfessionals?: string[];
    searchHistory?: any;
    notificationSettings?: any;
  }): Promise<ClientProfileEntity>;
  update(userId: string, data: Partial<ClientProfileEntity>): Promise<ClientProfileEntity>;
  delete(userId: string): Promise<void>;
}

export const CLIENT_PROFILE_REPOSITORY = Symbol('ClientProfileRepository');
```

### PrismaClientProfileRepository Implementation

```typescript
// src/service/infrastructure/repositories/prisma-client-profile.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ClientProfileRepository } from '../../domain/repositories/client-profile.repository';
import { ClientProfileEntity } from '../../domain/entities/client-profile.entity';

@Injectable()
export class PrismaClientProfileRepository implements ClientProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<ClientProfileEntity | null> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!profile) return null;

    return this.toEntity(profile);
  }

  async findById(id: string): Promise<ClientProfileEntity | null> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { id },
    });

    if (!profile) return null;

    return this.toEntity(profile);
  }

  async create(data: {
    userId: string;
    preferences?: any;
    savedProfessionals?: string[];
    searchHistory?: any;
    notificationSettings?: any;
  }): Promise<ClientProfileEntity> {
    const profile = await this.prisma.clientProfile.create({
      data: {
        userId: data.userId,
        preferences: data.preferences || null,
        savedProfessionals: data.savedProfessionals || [],
        searchHistory: data.searchHistory || null,
        notificationSettings: data.notificationSettings || null,
      },
    });

    return this.toEntity(profile);
  }

  async update(userId: string, data: Partial<ClientProfileEntity>): Promise<ClientProfileEntity> {
    const profile = await this.prisma.clientProfile.update({
      where: { userId },
      data: {
        preferences: data.preferences !== undefined ? data.preferences : undefined,
        savedProfessionals: data.savedProfessionals !== undefined ? data.savedProfessionals : undefined,
        searchHistory: data.searchHistory !== undefined ? data.searchHistory : undefined,
        notificationSettings: data.notificationSettings !== undefined ? data.notificationSettings : undefined,
      },
    });

    return this.toEntity(profile);
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.clientProfile.delete({
      where: { userId },
    });
  }

  private toEntity(profile: any): ClientProfileEntity {
    return new ClientProfileEntity(
      profile.id,
      profile.userId,
      profile.preferences,
      profile.savedProfessionals,
      profile.searchHistory,
      profile.notificationSettings,
      profile.createdAt,
      profile.updatedAt,
    );
  }
}
```

---

## Application Layer

### ClientProfileService

```typescript
// src/service/application/services/client-profile.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ClientProfileRepository, CLIENT_PROFILE_REPOSITORY } from '../../domain/repositories/client-profile.repository';
import { UserRepository, USER_REPOSITORY } from '../../../user-management/domain/repositories/user.repository';
import { ClientProfileEntity } from '../../domain/entities/client-profile.entity';
import { CreateClientProfileDto } from '../dto/create-client-profile.dto';
import { UpdateClientProfileDto } from '../dto/update-client-profile.dto';

@Injectable()
export class ClientProfileService {
  constructor(
    @Inject(CLIENT_PROFILE_REPOSITORY)
    private readonly clientProfileRepository: ClientProfileRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async createProfile(userId: string, createDto: CreateClientProfileDto): Promise<ClientProfileEntity> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive()) {
      throw new BadRequestException('User must be active to create client profile');
    }

    const existing = await this.clientProfileRepository.findByUserId(userId);
    if (existing) {
      throw new BadRequestException('Client profile already exists');
    }

    return this.clientProfileRepository.create({
      userId,
      preferences: createDto.preferences,
      savedProfessionals: [],
      searchHistory: null,
      notificationSettings: createDto.notificationSettings,
    });
  }

  async getProfile(userId: string): Promise<ClientProfileEntity> {
    const profile = await this.clientProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Client profile not found');
    }
    return profile;
  }

  async updateProfile(userId: string, updateDto: UpdateClientProfileDto): Promise<ClientProfileEntity> {
    const profile = await this.getProfile(userId);
    
    const updatedData: Partial<ClientProfileEntity> = {};
    if (updateDto.preferences !== undefined) {
      updatedData.preferences = updateDto.preferences;
    }
    if (updateDto.notificationSettings !== undefined) {
      updatedData.notificationSettings = updateDto.notificationSettings;
    }

    return this.clientProfileRepository.update(userId, updatedData);
  }

  async addSavedProfessional(userId: string, professionalId: string): Promise<ClientProfileEntity> {
    const profile = await this.getProfile(userId);
    const updated = profile.addSavedProfessional(professionalId);
    return this.clientProfileRepository.update(userId, {
      savedProfessionals: updated.savedProfessionals,
    });
  }

  async removeSavedProfessional(userId: string, professionalId: string): Promise<ClientProfileEntity> {
    const profile = await this.getProfile(userId);
    const updated = profile.removeSavedProfessional(professionalId);
    return this.clientProfileRepository.update(userId, {
      savedProfessionals: updated.savedProfessionals,
    });
  }

  async getSavedProfessionals(userId: string): Promise<string[]> {
    const profile = await this.getProfile(userId);
    return profile.savedProfessionals;
  }
}
```

### Updated RequestService

```typescript
// src/service/application/services/request.service.ts
async create(clientId: string, createDto: CreateRequestDto): Promise<RequestEntity> {
  const user = await this.userRepository.findById(clientId);
  if (!user) {
    throw new NotFoundException('User not found');
  }

  // NEW: Check client profile instead of role
  if (!user.hasClientProfile()) {
    throw new BadRequestException('Client profile required to create requests');
  }

  if (!user.isActive()) {
    throw new BadRequestException('User must be active');
  }

  const professional = await this.professionalRepository.findById(createDto.professionalId);
  if (!professional) {
    throw new NotFoundException('Professional not found');
  }

  if (!professional.isActive()) {
    throw new BadRequestException('Professional is not active');
  }

  return this.requestRepository.create({
    clientId,
    professionalId: createDto.professionalId,
    description: createDto.description,
    status: RequestStatus.PENDING,
    quoteAmount: null,
    quoteNotes: null,
  });
}
```

### Updated ProfessionalService

```typescript
// src/service/application/services/professional.service.ts
async createProfile(userId: string, createDto: CreateProfessionalDto): Promise<ProfessionalEntity> {
  const user = await this.userRepository.findById(userId);
  if (!user) {
    throw new NotFoundException('User not found');
  }

  // REMOVED: Role check
  // if (!user.isProfessional()) {
  //   throw new BadRequestException('User must have PROFESSIONAL role');
  // }

  // NEW: Just check if profile exists
  const existing = await this.professionalRepository.findByUserId(userId);
  if (existing) {
    throw new BadRequestException('Professional profile already exists');
  }

  if (!user.isActive()) {
    throw new BadRequestException('User must be active');
  }

  // ... rest of creation logic
}
```

---

## Presentation Layer

### Guards

```typescript
// src/shared/presentation/guards/has-client-profile.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ClientProfileRepository, CLIENT_PROFILE_REPOSITORY } from '../../../service/domain/repositories/client-profile.repository';
import { UserEntity } from '../../../user-management/domain/entities/user.entity';

@Injectable()
export class HasClientProfileGuard implements CanActivate {
  constructor(
    @Inject(CLIENT_PROFILE_REPOSITORY)
    private readonly clientProfileRepository: ClientProfileRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: UserEntity = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const profile = await this.clientProfileRepository.findByUserId(user.id);
    if (!profile) {
      throw new ForbiddenException('Client profile required');
    }

    return true;
  }
}

// src/shared/presentation/guards/has-professional-profile.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ProfessionalRepository, PROFESSIONAL_REPOSITORY } from '../../../service/domain/repositories/professional.repository';
import { UserEntity } from '../../../user-management/domain/entities/user.entity';

@Injectable()
export class HasProfessionalProfileGuard implements CanActivate {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: UserEntity = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const profile = await this.professionalRepository.findByUserId(user.id);
    if (!profile) {
      throw new ForbiddenException('Professional profile required');
    }

    return true;
  }
}
```

### Controllers

```typescript
// src/service/presentation/service.controller.ts
// Updated endpoints

@Post('requests')
@UseGuards(JwtAuthGuard, HasClientProfileGuard) // NEW: Check client profile
@ApiBearerAuth()
async createRequest(@CurrentUser() user: UserEntity, @Body() createDto: CreateRequestDto) {
  return this.requestService.create(user.id, createDto);
}

@Post('professionals/me/profile')
@UseGuards(JwtAuthGuard) // No role check needed
@ApiBearerAuth()
async createProfile(@CurrentUser() user: UserEntity, @Body() createDto: CreateProfessionalDto) {
  return this.professionalService.createProfile(user.id, createDto);
}

@Get('professionals/me/profile')
@UseGuards(JwtAuthGuard, HasProfessionalProfileGuard) // Check profile existence
@ApiBearerAuth()
async getMyProfile(@CurrentUser() user: UserEntity) {
  return this.professionalService.findByUserId(user.id);
}

// NEW: Client Profile endpoints
@Post('clients/me/profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
async createClientProfile(@CurrentUser() user: UserEntity, @Body() createDto: CreateClientProfileDto) {
  return this.clientProfileService.createProfile(user.id, createDto);
}

@Get('clients/me/profile')
@UseGuards(JwtAuthGuard, HasClientProfileGuard)
@ApiBearerAuth()
async getClientProfile(@CurrentUser() user: UserEntity) {
  return this.clientProfileService.getProfile(user.id);
}

@Post('clients/me/saved-professionals/:professionalId')
@UseGuards(JwtAuthGuard, HasClientProfileGuard)
@ApiBearerAuth()
async addSavedProfessional(
  @CurrentUser() user: UserEntity,
  @Param('professionalId') professionalId: string,
) {
  return this.clientProfileService.addSavedProfessional(user.id, professionalId);
}
```

---

## Migration Script

```typescript
// prisma/migrations/add_client_profile/migration.sql
-- Create ClientProfile table
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferences" JSONB,
    "savedProfessionals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "searchHistory" JSONB,
    "notificationSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- Create unique index
CREATE UNIQUE INDEX "client_profiles_userId_key" ON "client_profiles"("userId");

-- Add foreign key
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing users: Create client profiles for all active users
INSERT INTO "client_profiles" ("id", "userId", "preferences", "savedProfessionals", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    u.id,
    NULL,
    ARRAY[]::TEXT[],
    u."createdAt",
    NOW()
FROM "users" u
WHERE u.status = 'ACTIVE'
ON CONFLICT ("userId") DO NOTHING;
```

---

## Registration Flow Changes

### Updated Register Service

```typescript
// src/user-management/application/services/authentication.service.ts
async register(registerDto: RegisterDto) {
  // ... existing validation

  const user = await this.userRepository.create({
    email: registerDto.email,
    password: hashedPassword,
    firstName: registerDto.firstName,
    lastName: registerDto.lastName,
    phone: registerDto.phone || null,
    role: registerDto.role, // Keep for legacy
    status: UserStatus.PENDING,
  });

  // NEW: Auto-create client profile if registering as CLIENT
  if (registerDto.role === UserRole.CLIENT) {
    await this.clientProfileService.createProfile(user.id, {
      preferences: null,
      notificationSettings: null,
    });
  }

  const token = this.generateToken(user);

  return {
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    },
  };
}
```

---

## Key Differences: Option 1 vs Option 5

### Data Model

| Aspect | Option 1 | Option 5 |
|--------|----------|----------|
| **Client Data** | ❌ Stored in User or nowhere | ✅ Dedicated ClientProfile table |
| **Professional Data** | ✅ Professional table | ✅ Professional table |
| **Explicit Capabilities** | ⚠️ Implicit (profile existence) | ✅ Explicit (profile existence) |
| **Client Preferences** | ❌ No storage | ✅ ClientProfile.preferences |
| **Saved Professionals** | ❌ No feature | ✅ ClientProfile.savedProfessionals |
| **Search History** | ❌ No storage | ✅ ClientProfile.searchHistory |

### Code Changes

| Component | Option 1 | Option 5 |
|-----------|----------|----------|
| **New Entities** | 0 | 1 (ClientProfileEntity) |
| **New Repositories** | 0 | 1 (ClientProfileRepository) |
| **New Services** | 0 | 1 (ClientProfileService) |
| **New Guards** | 1 (HasProfessionalProfileGuard) | 2 (HasClientProfileGuard, HasProfessionalProfileGuard) |
| **Schema Changes** | 0 | 1 (ClientProfile table) |
| **Migration Scripts** | 0 | 1 (create table + migrate data) |

### Feature Capabilities

| Feature | Option 1 | Option 5 |
|---------|----------|----------|
| **Dual Role** | ✅ Yes | ✅ Yes |
| **Client Favorites** | ❌ No | ✅ Yes |
| **Client Preferences** | ❌ No | ✅ Yes |
| **Client Analytics** | ⚠️ Limited | ✅ Full |
| **Future Client Features** | ❌ Hard to add | ✅ Easy to add |

---

## When to Choose Each

### Choose Option 1 if:
- ✅ Need feature working **this week**
- ✅ No immediate client features planned
- ✅ Want minimal code changes
- ✅ Can't do database migration right now
- ✅ Team prefers simplicity

### Choose Option 5 if:
- ✅ Planning client features (favorites, preferences, history)
- ✅ Want explicit, clear architecture
- ✅ Have 1-2 weeks for implementation
- ✅ Value long-term maintainability
- ✅ Want room for future expansion
- ✅ Need better analytics

---

## Implementation Timeline: Option 5

### Week 1: Foundation
- Day 1-2: Schema changes + migration
- Day 3-4: Domain entities + repositories
- Day 5: Services + guards

### Week 2: Integration
- Day 1-2: Update existing services
- Day 3: Update controllers
- Day 4: Testing
- Day 5: Documentation + deployment

**Total: ~10 days**

---

## Conclusion

**Option 5 provides:**
- ✅ Explicit data model
- ✅ Room for client features
- ✅ Better architecture
- ✅ Future-proof design

**But requires:**
- ⚠️ More implementation time
- ⚠️ Database migration
- ⚠️ More code to maintain

**The choice depends on your timeline and future plans!**

