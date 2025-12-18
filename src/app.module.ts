import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// Legacy modules (will be deprecated)
import { UserManagementModule } from './user-management/user-management.module';
import { ServiceModule } from './service/service.module';
// New bounded context modules
import { IdentityModule } from './identity/identity.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RequestsModule } from './requests/requests.module';
// Other modules
import { ReputationModule } from './reputation/reputation.module';
import { ContactModule } from './contact/contact.module';
import { AdminModule } from './admin/admin.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    // New modules
    IdentityModule,
    ProfilesModule,
    RequestsModule,
    // Legacy modules (keeping for controllers)
    UserManagementModule,
    ServiceModule,
    // Other modules
    ReputationModule,
    ContactModule,
    AdminModule,
    StorageModule,
  ],
})
export class AppModule {}
