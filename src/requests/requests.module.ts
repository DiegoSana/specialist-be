import { Module, forwardRef } from '@nestjs/common';

// Domain
import { REQUEST_REPOSITORY } from './domain/repositories/request.repository';
import { REQUEST_INTEREST_REPOSITORY } from './domain/repositories/request-interest.repository';

// Application
import { RequestService } from './application/services/request.service';
import { RequestInterestService } from './application/services/request-interest.service';

// Infrastructure
import { PrismaRequestRepository } from './infrastructure/repositories/prisma-request.repository';
import { PrismaRequestInterestRepository } from './infrastructure/repositories/prisma-request-interest.repository';

// Presentation
import { RequestsController } from './presentation/requests.controller';

// Shared
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';

// Cross-context dependencies
import { IdentityModule } from '../identity/identity.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => IdentityModule),
    forwardRef(() => ProfilesModule),
  ],
  controllers: [RequestsController],
  providers: [
    RequestService,
    RequestInterestService,
    {
      provide: REQUEST_REPOSITORY,
      useClass: PrismaRequestRepository,
    },
    {
      provide: REQUEST_INTEREST_REPOSITORY,
      useClass: PrismaRequestInterestRepository,
    },
  ],
  exports: [
    RequestService,
    RequestInterestService,
    REQUEST_REPOSITORY,
    REQUEST_INTEREST_REPOSITORY,
  ],
})
export class RequestsModule {}
