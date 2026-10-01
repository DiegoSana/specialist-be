import { Module, forwardRef } from '@nestjs/common';
import { ReviewService } from './application/services/review.service';
import { RequestPublishedAgainHandler } from './application/handlers/request-published-again.handler';
import { RevealReviewsJob } from './application/jobs/reveal-reviews.job';
import { REVIEW_REPOSITORY } from './domain/repositories/review.repository';
import { PrismaReviewRepository } from './infrastructure/repositories/prisma-review.repository';
// Presentation
import {
  ReviewsController,
  ProfessionalReviewsController,
  ServiceProviderReviewsController,
} from './presentation/reviews.controller';
// Import new bounded context modules
import { ProfilesModule } from '../profiles/profiles.module';
import { RequestsModule } from '../requests/requests.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    forwardRef(() => ProfilesModule),
    // Circular: RequestService.rateClient delegates Review creation to ReviewService, and
    // ReviewService reads requests via RequestService — see RequestsModule's forwardRef back to
    // this module for the other half of the cycle.
    forwardRef(() => RequestsModule),
    forwardRef(() => IdentityModule),
  ],
  controllers: [
    ReviewsController,
    ProfessionalReviewsController,
    ServiceProviderReviewsController,
  ],
  providers: [
    ReviewService,
    RequestPublishedAgainHandler,
    RevealReviewsJob,
    {
      provide: REVIEW_REPOSITORY,
      useClass: PrismaReviewRepository,
    },
  ],
  exports: [ReviewService],
})
export class ReputationModule {}
