import { Module, forwardRef } from '@nestjs/common';

// Domain
import { REQUEST_REPOSITORY } from './domain/repositories/request.repository';
import { REQUEST_QUERY_REPOSITORY } from './domain/queries/request.query-repository';
import {
  REQUEST_INTEREST_REPOSITORY,
  RequestInterestRepository,
} from './domain/repositories/request-interest.repository';
import { REQUEST_INTERACTION_REPOSITORY } from './domain/repositories/request-interaction.repository';
import { REQUEST_INTERACTION_QUERY_REPOSITORY } from './domain/queries/request-interaction.query-repository';
import { REQUEST_ATTENTION_FLAG_REPOSITORY } from './domain/repositories/request-attention-flag.repository';
import { REQUEST_ATTENTION_QUERY_REPOSITORY } from './domain/queries/request-attention.query-repository';

// Application
import { RequestService } from './application/services/request.service';
import { RequestInterestService } from './application/services/request-interest.service';
import { RequestInteractionService } from './application/services/request-interaction.service';
import { AdminWhatsAppService } from './application/services/admin-whatsapp.service';
import { AdminRequestAttentionService } from './application/services/admin-request-attention.service';
import { WhatsAppDispatchJob } from './application/jobs/whatsapp-dispatch.job';
import { FollowUpSchedulerJob } from './application/jobs/follow-up-scheduler.job';
import { RequestExpirationJob } from './application/jobs/request-expiration.job';
import { FOLLOW_UP_RULES } from './application/jobs/follow-up-scheduler.job';
import { MessageStatusCheckerJob } from './application/jobs/message-status-checker.job';
import { DetectResponseIntentUseCase } from './application/use-cases/detect-response-intent.use-case';
import { RequestInteractionRespondedHandler } from './application/handlers/request-interaction-responded.handler';
import { RequestAttentionService } from './application/services/request-attention.service';
import { FollowUpQueryExecutor } from './application/follow-up/follow-up-query-executor';
import { buildFollowUpRules } from './application/follow-up/follow-up-ladders';

// Infrastructure
import { PrismaRequestRepository } from './infrastructure/repositories/prisma-request.repository';
import { PrismaRequestQueryRepository } from './infrastructure/queries/prisma-request.query-repository';
import { PrismaRequestInterestRepository } from './infrastructure/repositories/prisma-request-interest.repository';
import { PrismaRequestInteractionRepository } from './infrastructure/repositories/prisma-request-interaction.repository';
import { PrismaRequestInteractionQueryRepository } from './infrastructure/queries/prisma-request-interaction.query-repository';
import { PrismaRequestAttentionFlagRepository } from './infrastructure/repositories/prisma-request-attention-flag.repository';
import { PrismaRequestAttentionQueryRepository } from './infrastructure/queries/prisma-request-attention.query-repository';
import { intentDetectionProvider } from './infrastructure/adapters/intent-detection.factory';
import { AnthropicIntentDetectionAdapter } from './infrastructure/adapters/anthropic-intent-detection.adapter';

// Presentation
import { RequestsController } from './presentation/requests.controller';
import { TwilioWebhookController } from './presentation/controllers/twilio-webhook.controller';
import { AdminWhatsAppController } from './presentation/controllers/admin-whatsapp.controller';
import { AdminWhatsAppDevController } from './presentation/controllers/admin-whatsapp-dev.controller';
import { AdminRequestAttentionController } from './presentation/controllers/admin-request-attention.controller';
import { TwilioWebhookGuard } from './presentation/guards/twilio-webhook.guard';
import { TwilioRateLimitGuard } from './presentation/guards/twilio-rate-limit.guard';

// Shared
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';
import { MessagingModule } from '../shared/infrastructure/messaging/messaging.module';

// Cross-context dependencies
import { IdentityModule } from '../identity/identity.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [
    PrismaModule,
    MessagingModule,
    forwardRef(() => IdentityModule),
    forwardRef(() => ProfilesModule),
    SupportModule,
  ],
  controllers: [
    RequestsController,
    TwilioWebhookController,
    AdminWhatsAppController,
    AdminRequestAttentionController,
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
    AdminRequestAttentionService,
    WhatsAppDispatchJob,
    FollowUpSchedulerJob,
    RequestExpirationJob,
    MessageStatusCheckerJob,
    TwilioWebhookGuard,
    TwilioRateLimitGuard,
    DetectResponseIntentUseCase,
    RequestInteractionRespondedHandler,
    RequestAttentionService,
    FollowUpQueryExecutor,
    {
      provide: FOLLOW_UP_RULES,
      useFactory: (interestRepository: RequestInterestRepository) =>
        buildFollowUpRules(interestRepository),
      inject: [REQUEST_INTEREST_REPOSITORY],
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
    {
      provide: REQUEST_ATTENTION_FLAG_REPOSITORY,
      useClass: PrismaRequestAttentionFlagRepository,
    },
    {
      provide: REQUEST_ATTENTION_QUERY_REPOSITORY,
      useClass: PrismaRequestAttentionQueryRepository,
    },
    AnthropicIntentDetectionAdapter,
    intentDetectionProvider,
  ],
  exports: [
    RequestService,
    RequestInterestService,
    RequestInteractionService,
    // Note: Repositories are NOT exported - use Services instead (DDD best practice)
  ],
})
export class RequestsModule {}
