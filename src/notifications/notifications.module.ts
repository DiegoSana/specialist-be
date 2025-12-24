import { Module, forwardRef } from '@nestjs/common';

// Domain
import { IN_APP_NOTIFICATION_REPOSITORY } from './domain/repositories/in-app-notification.repository';
import { EMAIL_SENDER } from './domain/ports/email-sender';
import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository';

// Application
import { InAppNotificationService } from './application/services/in-app-notification.service';
import { RequestsNotificationsHandler } from './application/handlers/requests-notifications.handler';
import { NotificationPreferencesService } from './application/services/notification-preferences.service';
import { NotificationService } from './application/services/notification.service';
import { NotificationRetentionJob } from './application/jobs/notification-retention.job';
import { NotificationDispatchService } from './application/services/notification-dispatch.service';
import { NotificationDispatchJob } from './application/jobs/notification-dispatch.job';

// Infrastructure
import { PrismaInAppNotificationRepository } from './infrastructure/repositories/prisma-in-app-notification.repository';
import { SmtpEmailSender } from './infrastructure/email/smtp-email-sender';
import { PrismaNotificationPreferencesRepository } from './infrastructure/repositories/prisma-notification-preferences.repository';
import { NOTIFICATION_PREFERENCES_REPOSITORY } from './domain/repositories/notification-preferences.repository';
import { PrismaNotificationRepository } from './infrastructure/repositories/prisma-notification.repository';
import { NOTIFICATION_DELIVERY_QUEUE } from './domain/ports/notification-delivery-queue';
import { PrismaNotificationDeliveryQueue } from './infrastructure/repositories/prisma-notification-delivery-queue';

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
    NotificationService,
    InAppNotificationService,
    NotificationPreferencesService,
    NotificationRetentionJob,
    NotificationDispatchService,
    NotificationDispatchJob,
    RequestsNotificationsHandler,
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
    {
      provide: EMAIL_SENDER,
      useClass: SmtpEmailSender,
    },
    {
      provide: NOTIFICATION_DELIVERY_QUEUE,
      useClass: PrismaNotificationDeliveryQueue,
    },
  ],
  exports: [NotificationService, NotificationPreferencesService],
})
export class NotificationsModule {}
