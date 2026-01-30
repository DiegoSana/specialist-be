import { Module, forwardRef } from '@nestjs/common';

// Domain
import { REQUEST_REPOSITORY } from './domain/repositories/request.repository';
import { REQUEST_INTEREST_REPOSITORY } from './domain/repositories/request-interest.repository';
import {
  REQUEST_INTERACTION_REPOSITORY,
} from './domain/repositories/request-interaction.repository';
import { WHATSAPP_MESSAGING_PORT } from './domain/ports/whatsapp-messaging.port';

// Application
import { RequestService } from './application/services/request.service';
import { RequestInterestService } from './application/services/request-interest.service';
import { RequestInteractionService } from './application/services/request-interaction.service';
import { WhatsAppDispatchJob } from './application/jobs/whatsapp-dispatch.job';
import { FollowUpSchedulerJob } from './application/jobs/follow-up-scheduler.job';
import { MessageStatusCheckerJob } from './application/jobs/message-status-checker.job';
import { DetectResponseIntentUseCase } from './application/use-cases/detect-response-intent.use-case';
import { RequestInteractionRespondedHandler } from './application/handlers/request-interaction-responded.handler';

// Infrastructure
import { PrismaRequestRepository } from './infrastructure/repositories/prisma-request.repository';
import { PrismaRequestInterestRepository } from './infrastructure/repositories/prisma-request-interest.repository';
import { PrismaRequestInteractionRepository } from './infrastructure/repositories/prisma-request-interaction.repository';
import { TwilioWhatsAppAdapter } from './infrastructure/adapters/twilio-whatsapp.adapter';

// Presentation
import { RequestsController } from './presentation/requests.controller';
import { TwilioWebhookController } from './presentation/controllers/twilio-webhook.controller';
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
  controllers: [RequestsController, TwilioWebhookController],
  providers: [
    RequestService,
    RequestInterestService,
    RequestInteractionService,
    WhatsAppDispatchJob,
    FollowUpSchedulerJob,
    MessageStatusCheckerJob,
    TwilioWebhookGuard,
    TwilioRateLimitGuard,
    DetectResponseIntentUseCase,
    RequestInteractionRespondedHandler,
    {
      provide: REQUEST_REPOSITORY,
      useClass: PrismaRequestRepository,
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
      provide: WHATSAPP_MESSAGING_PORT,
      useClass: TwilioWhatsAppAdapter,
    },
  ],
  exports: [
    RequestService,
    RequestInterestService,
    RequestInteractionService,
    // Note: Repositories are NOT exported - use Services instead (DDD best practice)
  ],
})
export class RequestsModule {}
