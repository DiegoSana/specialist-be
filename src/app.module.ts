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
  ],
})
export class AppModule {}
