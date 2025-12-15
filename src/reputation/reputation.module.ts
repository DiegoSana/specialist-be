import { Module } from '@nestjs/common';
import { ReputationController } from './presentation/reputation.controller';
import { ReviewService } from './application/services/review.service';
import { ReviewRepository, REVIEW_REPOSITORY } from './domain/repositories/review.repository';
import { PrismaReviewRepository } from './infrastructure/repositories/prisma-review.repository';
import { ServiceModule } from '../service/service.module';
import { UserManagementModule } from '../user-management/user-management.module';

@Module({
  imports: [ServiceModule, UserManagementModule],
  controllers: [ReputationController],
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
