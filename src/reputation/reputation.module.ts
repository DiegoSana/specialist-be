import { Module } from '@nestjs/common';
import { ReviewService } from './application/services/review.service';
import { ReviewRepository, REVIEW_REPOSITORY } from './domain/repositories/review.repository';
import { PrismaReviewRepository } from './infrastructure/repositories/prisma-review.repository';
// Presentation
import { ReviewsController, ProfessionalReviewsController } from './presentation/reviews.controller';
// Import new bounded context modules
import { ProfilesModule } from '../profiles/profiles.module';
import { RequestsModule } from '../requests/requests.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [ProfilesModule, RequestsModule, IdentityModule],
  controllers: [ReviewsController, ProfessionalReviewsController],
  providers: [
    ReviewService,
    {
      provide: REVIEW_REPOSITORY,
      useClass: PrismaReviewRepository,
    },
  ],
  exports: [ReviewService, REVIEW_REPOSITORY],
})
export class ReputationModule {}
