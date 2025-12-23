import { Module, forwardRef } from '@nestjs/common';

// Domain
import { IN_APP_NOTIFICATION_REPOSITORY } from './domain/repositories/in-app-notification.repository';

// Application
import { InAppNotificationService } from './application/services/in-app-notification.service';
import { RequestsNotificationsHandler } from './application/handlers/requests-notifications.handler';

// Infrastructure
import { PrismaInAppNotificationRepository } from './infrastructure/repositories/prisma-in-app-notification.repository';

// Presentation
import { NotificationsController } from './presentation/notifications.controller';

// Shared
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';

// Cross-context dependencies
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ProfilesModule)],
  controllers: [NotificationsController],
  providers: [
    InAppNotificationService,
    RequestsNotificationsHandler,
    {
      provide: IN_APP_NOTIFICATION_REPOSITORY,
      useClass: PrismaInAppNotificationRepository,
    },
  ],
  exports: [InAppNotificationService],
})
export class NotificationsModule {}

