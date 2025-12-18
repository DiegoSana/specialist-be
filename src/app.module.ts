import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// Bounded Context Modules
import { IdentityModule } from './identity/identity.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RequestsModule } from './requests/requests.module';
import { ReputationModule } from './reputation/reputation.module';
import { ContactModule } from './contact/contact.module';
import { AdminModule } from './admin/admin.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
// Shared Infrastructure
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
// Legacy modules - keeping only for backwards-compatible API routes
import { UserManagementModule } from './user-management/user-management.module';
import { ServiceModule } from './service/service.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    // Core Bounded Contexts
    IdentityModule,
    ProfilesModule,
    RequestsModule,
    // Supporting Bounded Contexts
    ReputationModule,
    ContactModule,
    AdminModule,
    StorageModule,
    // Legacy modules (thin wrappers for API compatibility)
    UserManagementModule,
    ServiceModule,
  ],
})
export class AppModule {}
