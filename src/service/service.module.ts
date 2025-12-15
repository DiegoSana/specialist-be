import { Module } from '@nestjs/common';
import { ServiceController } from './presentation/service.controller';
import { ProfessionalService } from './application/services/professional.service';
import { TradeService } from './application/services/trade.service';
import { RequestService } from './application/services/request.service';
import { RequestInterestService } from './application/services/request-interest.service';
import { ProfessionalRepository, PROFESSIONAL_REPOSITORY } from './domain/repositories/professional.repository';
import { TradeRepository, TRADE_REPOSITORY } from './domain/repositories/trade.repository';
import { RequestRepository, REQUEST_REPOSITORY } from './domain/repositories/request.repository';
import { REQUEST_INTEREST_REPOSITORY } from './domain/repositories/request-interest.repository';
import { PrismaProfessionalRepository } from './infrastructure/repositories/prisma-professional.repository';
import { PrismaTradeRepository } from './infrastructure/repositories/prisma-trade.repository';
import { PrismaRequestRepository } from './infrastructure/repositories/prisma-request.repository';
import { PrismaRequestInterestRepository } from './infrastructure/repositories/prisma-request-interest.repository';
import { UserManagementModule } from '../user-management/user-management.module';

@Module({
  imports: [UserManagementModule],
  controllers: [ServiceController],
  providers: [
    ProfessionalService,
    TradeService,
    RequestService,
    RequestInterestService,
    {
      provide: PROFESSIONAL_REPOSITORY,
      useClass: PrismaProfessionalRepository,
    },
    {
      provide: TRADE_REPOSITORY,
      useClass: PrismaTradeRepository,
    },
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
    ProfessionalService,
    TradeService,
    RequestService,
    RequestInterestService,
    PROFESSIONAL_REPOSITORY,
    TRADE_REPOSITORY,
    REQUEST_REPOSITORY,
    REQUEST_INTEREST_REPOSITORY,
  ],
})
export class ServiceModule {}
