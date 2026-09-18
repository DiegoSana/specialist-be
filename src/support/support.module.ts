import { Module, forwardRef } from '@nestjs/common';

// Domain
import { SUPPORT_CONVERSATION_REPOSITORY } from './domain/repositories/support-conversation.repository';
import { SUPPORT_MESSAGE_REPOSITORY } from './domain/repositories/support-message.repository';

// Application
import { SupportConversationService } from './application/services/support-conversation.service';

// Infrastructure
import { PrismaSupportConversationRepository } from './infrastructure/repositories/prisma-support-conversation.repository';
import { PrismaSupportMessageRepository } from './infrastructure/repositories/prisma-support-message.repository';

// Presentation
import { AdminSupportConversationController } from './presentation/controllers/admin-support-conversation.controller';

// Shared
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';
import { MessagingModule } from '../shared/infrastructure/messaging/messaging.module';

// Cross-context dependencies
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [PrismaModule, MessagingModule, forwardRef(() => IdentityModule)],
  controllers: [AdminSupportConversationController],
  providers: [
    SupportConversationService,
    {
      provide: SUPPORT_CONVERSATION_REPOSITORY,
      useClass: PrismaSupportConversationRepository,
    },
    {
      provide: SUPPORT_MESSAGE_REPOSITORY,
      useClass: PrismaSupportMessageRepository,
    },
  ],
  exports: [
    SupportConversationService,
    // Note: Repositories are NOT exported - use Services instead (DDD best practice)
  ],
})
export class SupportModule {}
