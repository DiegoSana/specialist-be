import { Module, forwardRef } from '@nestjs/common';

// Domain
import { CLIENT_REPOSITORY } from './domain/repositories/client.repository';
import { PROFESSIONAL_REPOSITORY } from './domain/repositories/professional.repository';
import { TRADE_REPOSITORY } from './domain/repositories/trade.repository';

// Application
import { ClientService } from './application/services/client.service';
import { ProfessionalService } from './application/services/professional.service';
import { TradeService } from './application/services/trade.service';

// Infrastructure
import { PrismaClientRepository } from './infrastructure/repositories/prisma-client.repository';
import { PrismaProfessionalRepository } from './infrastructure/repositories/prisma-professional.repository';
import { PrismaTradeRepository } from './infrastructure/repositories/prisma-trade.repository';

// Presentation
import { ClientController } from './presentation/client.controller';

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
  controllers: [ClientController],
  providers: [
    ClientService,
    ProfessionalService,
    TradeService,
    {
      provide: CLIENT_REPOSITORY,
      useClass: PrismaClientRepository,
    },
    {
      provide: PROFESSIONAL_REPOSITORY,
      useClass: PrismaProfessionalRepository,
    },
    {
      provide: TRADE_REPOSITORY,
      useClass: PrismaTradeRepository,
    },
  ],
  exports: [
    ClientService,
    ProfessionalService,
    TradeService,
    CLIENT_REPOSITORY,
    PROFESSIONAL_REPOSITORY,
    TRADE_REPOSITORY,
  ],
})
export class ProfilesModule {}
