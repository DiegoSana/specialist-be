import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
// Bounded Context Modules
import { IdentityModule } from './identity/identity.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RequestsModule } from './requests/requests.module';
import { ReputationModule } from './reputation/reputation.module';
import { ContactModule } from './contact/contact.module';
import { AdminModule } from './admin/admin.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
// Shared Infrastructure
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { EventsModule } from './shared/infrastructure/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EventsModule,
    HealthModule,
    // Core Bounded Contexts
    IdentityModule,
    ProfilesModule,
    RequestsModule,
    NotificationsModule,
    // Supporting Bounded Contexts
    ReputationModule,
    ContactModule,
    AdminModule,
    StorageModule,
  ],
})
export class AppModule {}
