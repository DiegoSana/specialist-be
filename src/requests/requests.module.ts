import { Module, forwardRef } from '@nestjs/common';

// Domain
import { REQUEST_REPOSITORY } from './domain/repositories/request.repository';
import { REQUEST_QUERY_REPOSITORY } from './domain/queries/request.query-repository';
import { REQUEST_INTEREST_REPOSITORY } from './domain/repositories/request-interest.repository';
import { REQUEST_INTERACTION_REPOSITORY } from './domain/repositories/request-interaction.repository';
import { REQUEST_INTERACTION_QUERY_REPOSITORY } from './domain/queries/request-interaction.query-repository';

// Application
import { RequestService } from './application/services/request.service';
import { RequestInterestService } from './application/services/request-interest.service';
import { RequestInteractionService } from './application/services/request-interaction.service';
import { AdminWhatsAppService } from './application/services/admin-whatsapp.service';
import { WhatsAppDispatchJob } from './application/jobs/whatsapp-dispatch.job';
import { FollowUpSchedulerJob } from './application/jobs/follow-up-scheduler.job';
import { FOLLOW_UP_RULES } from './application/jobs/follow-up-scheduler.job';
import { MessageStatusCheckerJob } from './application/jobs/message-status-checker.job';
import { DetectResponseIntentUseCase } from './application/use-cases/detect-response-intent.use-case';
import { RequestInteractionRespondedHandler } from './application/handlers/request-interaction-responded.handler';
import { FollowUpQueryExecutor } from './application/follow-up/follow-up-query-executor';
import {
  Accepted3DaysFollowUpRule,
  Accepted7DaysFollowUpRule,
  InProgress5DaysFollowUpRule,
  InProgress10DaysFollowUpRule,
  Done1DayFollowUpRule,
  Pending3DaysWithInterestsFollowUpRule,
} from './application/follow-up/rules';

// Infrastructure
import { PrismaRequestRepository } from './infrastructure/repositories/prisma-request.repository';
import { PrismaRequestQueryRepository } from './infrastructure/queries/prisma-request.query-repository';
import { PrismaRequestInterestRepository } from './infrastructure/repositories/prisma-request-interest.repository';
import { PrismaRequestInteractionRepository } from './infrastructure/repositories/prisma-request-interaction.repository';
import { PrismaRequestInteractionQueryRepository } from './infrastructure/queries/prisma-request-interaction.query-repository';
import { whatsAppMessagingProvider } from './infrastructure/adapters/whatsapp-messaging.factory';

// Presentation
import { RequestsController } from './presentation/requests.controller';
import { TwilioWebhookController } from './presentation/controllers/twilio-webhook.controller';
import { AdminWhatsAppController } from './presentation/controllers/admin-whatsapp.controller';
import { AdminWhatsAppDevController } from './presentation/controllers/admin-whatsapp-dev.controller';
import { TwilioWebhookGuard } from './presentation/guards/twilio-webhook.guard';
import { TwilioRateLimitGuard } from './presentation/guards/twilio-rate-limit.guard';

// Shared
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';
import { MessagingModule } from '../shared/infrastructure/messaging/messaging.module';

// Cross-context dependencies
import { IdentityModule } from '../identity/identity.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [
    PrismaModule,
    MessagingModule,
    forwardRef(() => IdentityModule),
    forwardRef(() => ProfilesModule),
  ],
  controllers: [
    RequestsController,
    TwilioWebhookController,
    AdminWhatsAppController,
    ...(process.env.NODE_ENV !== 'production' ||
    process.env.WHATSAPP_DEV_MODE_ENABLED === 'true'
      ? [AdminWhatsAppDevController]
      : []),
  ],
  providers: [
    RequestService,
    RequestInterestService,
    RequestInteractionService,
    AdminWhatsAppService,
    WhatsAppDispatchJob,
    FollowUpSchedulerJob,
    MessageStatusCheckerJob,
    TwilioWebhookGuard,
    TwilioRateLimitGuard,
    DetectResponseIntentUseCase,
    RequestInteractionRespondedHandler,
    FollowUpQueryExecutor,
    Accepted3DaysFollowUpRule,
    Accepted7DaysFollowUpRule,
    InProgress5DaysFollowUpRule,
    InProgress10DaysFollowUpRule,
    Done1DayFollowUpRule,
    Pending3DaysWithInterestsFollowUpRule,
    {
      provide: FOLLOW_UP_RULES,
      useFactory: (
        r1: Accepted3DaysFollowUpRule,
        r2: Accepted7DaysFollowUpRule,
        r3: InProgress5DaysFollowUpRule,
        r4: InProgress10DaysFollowUpRule,
        r5: Done1DayFollowUpRule,
        r6: Pending3DaysWithInterestsFollowUpRule,
      ) => [r1, r2, r3, r4, r5, r6],
      inject: [
        Accepted3DaysFollowUpRule,
        Accepted7DaysFollowUpRule,
        InProgress5DaysFollowUpRule,
        InProgress10DaysFollowUpRule,
        Done1DayFollowUpRule,
        Pending3DaysWithInterestsFollowUpRule,
      ],
    },
    {
      provide: REQUEST_REPOSITORY,
      useClass: PrismaRequestRepository,
    },
    {
      provide: REQUEST_QUERY_REPOSITORY,
      useClass: PrismaRequestQueryRepository,
    },
    {
      provide: REQUEST_INTEREST_REPOSITORY,
      useClass: PrismaRequestInterestRepository,
    },
    {
      provide: REQUEST_INTERACTION_REPOSITORY,
      useClass: PrismaRequestInteractionRepository,
    },
    {
      provide: REQUEST_INTERACTION_QUERY_REPOSITORY,
      useClass: PrismaRequestInteractionQueryRepository,
    },
    whatsAppMessagingProvider,
  ],
  exports: [
    RequestService,
    RequestInterestService,
    RequestInteractionService,
    // Note: Repositories are NOT exported - use Services instead (DDD best practice)
  ],
})
export class RequestsModule {}
