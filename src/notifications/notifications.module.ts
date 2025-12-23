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

// Infrastructure
import { PrismaInAppNotificationRepository } from './infrastructure/repositories/prisma-in-app-notification.repository';
import { SmtpEmailSender } from './infrastructure/email/smtp-email-sender';
import { PrismaNotificationPreferencesRepository } from './infrastructure/repositories/prisma-notification-preferences.repository';
import { NOTIFICATION_PREFERENCES_REPOSITORY } from './domain/repositories/notification-preferences.repository';
import { PrismaNotificationRepository } from './infrastructure/repositories/prisma-notification.repository';

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
  ],
  exports: [NotificationService, NotificationPreferencesService],
})
export class NotificationsModule {}

