import { Module, forwardRef } from '@nestjs/common';

// Domain
import { CLIENT_REPOSITORY } from './domain/repositories/client.repository';
import { PROFESSIONAL_REPOSITORY } from './domain/repositories/professional.repository';
import { COMPANY_REPOSITORY } from './domain/repositories/company.repository';
import { TRADE_REPOSITORY } from './domain/repositories/trade.repository';

// Application
import { ClientService } from './application/services/client.service';
import { ProfessionalService } from './application/services/professional.service';
import { CompanyService } from './application/services/company.service';
import { TradeService } from './application/services/trade.service';
import { ProfileToggleService } from './application/services/profile-toggle.service';

// Infrastructure
import { PrismaClientRepository } from './infrastructure/repositories/prisma-client.repository';
import { PrismaProfessionalRepository } from './infrastructure/repositories/prisma-professional.repository';
import { PrismaCompanyRepository } from './infrastructure/repositories/prisma-company.repository';
import { PrismaTradeRepository } from './infrastructure/repositories/prisma-trade.repository';

// Presentation
import { ClientsController } from './presentation/clients.controller';
import { ProfessionalsController } from './presentation/professionals.controller';
import { CompaniesController } from './presentation/companies.controller';
import { TradesController } from './presentation/trades.controller';

// Shared
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';

// Cross-context dependencies
import { IdentityModule } from '../identity/identity.module';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => IdentityModule),
    forwardRef(() => RequestsModule),
  ],
  controllers: [
    ClientsController,
    ProfessionalsController,
    CompaniesController,
    TradesController,
  ],
  providers: [
    ClientService,
    ProfessionalService,
    CompanyService,
    TradeService,
    ProfileToggleService,
    {
      provide: CLIENT_REPOSITORY,
      useClass: PrismaClientRepository,
    },
    {
      provide: PROFESSIONAL_REPOSITORY,
      useClass: PrismaProfessionalRepository,
    },
    {
      provide: COMPANY_REPOSITORY,
      useClass: PrismaCompanyRepository,
    },
    {
      provide: TRADE_REPOSITORY,
      useClass: PrismaTradeRepository,
    },
  ],
  exports: [
    ClientService,
    ProfessionalService,
    CompanyService,
    TradeService,
    ProfileToggleService,
    // Note: Repositories are NOT exported - use Services instead (DDD best practice)
  ],
})
export class ProfilesModule {}
