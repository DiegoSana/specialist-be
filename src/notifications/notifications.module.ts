import { Module, forwardRef } from '@nestjs/common';

// Domain
import { IN_APP_NOTIFICATION_REPOSITORY } from './domain/repositories/in-app-notification.repository';
import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository';

// Application
import { InAppNotificationService } from './application/services/in-app-notification.service';
import { RequestsNotificationsHandler } from './application/handlers/requests-notifications.handler';
import { ReviewsNotificationsHandler } from './application/handlers/reviews-notifications.handler';
import { NotificationPreferencesService } from './application/services/notification-preferences.service';
import { NotificationService } from './application/services/notification.service';
import { NotificationRetentionJob } from './application/jobs/notification-retention.job';
import { NotificationDispatchService } from './application/services/notification-dispatch.service';
import { NotificationDispatchJob } from './application/jobs/notification-dispatch.job';

// Infrastructure
import { PrismaInAppNotificationRepository } from './infrastructure/repositories/prisma-in-app-notification.repository';
import { emailSenderProvider } from './infrastructure/email/email-sender.factory';
import { PrismaNotificationPreferencesRepository } from './infrastructure/repositories/prisma-notification-preferences.repository';
import { NOTIFICATION_PREFERENCES_REPOSITORY } from './domain/repositories/notification-preferences.repository';
import { PrismaNotificationRepository } from './infrastructure/repositories/prisma-notification.repository';
import { NOTIFICATION_DELIVERY_QUEUE } from './domain/ports/notification-delivery-queue';
import { PrismaNotificationDeliveryQueue } from './infrastructure/repositories/prisma-notification-delivery-queue';

// Presentation
import { NotificationsController } from './presentation/notifications.controller';
import { AdminNotificationsController } from './presentation/admin-notifications.controller';

// Shared
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';

// Cross-context dependencies
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ProfilesModule)],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    NotificationService,
    InAppNotificationService,
    NotificationPreferencesService,
    NotificationRetentionJob,
    NotificationDispatchService,
    NotificationDispatchJob,
    RequestsNotificationsHandler,
    ReviewsNotificationsHandler,
    {
      provide: IN_APP_NOTIFICATION_REPOSITORY,
      useClass: PrismaInAppNotificationRepository,
    },
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: PrismaNotificationRepository,
    },
    {
      provide: NOTIFICATION_PREFERENCES_REPOSITORY,
      useClass: PrismaNotificationPreferencesRepository,
    },
    // Dynamic email sender based on EMAIL_PROVIDER env var
    emailSenderProvider,
    {
      provide: NOTIFICATION_DELIVERY_QUEUE,
      useClass: PrismaNotificationDeliveryQueue,
    },
  ],
  exports: [NotificationService, NotificationPreferencesService],
})
export class NotificationsModule {}
