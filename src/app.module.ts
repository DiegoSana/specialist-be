import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
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
import { SupportModule } from './support/support.module';
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
    SupportModule,
    // Supporting Bounded Contexts
    ReputationModule,
    ContactModule,
    AdminModule,
    StorageModule,
  ],
  providers: [
    // Default rate-limit floor for every route (config lives in IdentityModule's
    // ThrottlerModule.forRoot — @Global, so it's already available here). Routes needing a
    // tighter or looser limit override it with @Throttle/@SkipThrottle.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
