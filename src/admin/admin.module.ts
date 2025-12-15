import { Module } from '@nestjs/common';
import { AdminService } from './application/admin.service';
import { AdminController } from './presentation/admin.controller';
import { UserRepository, USER_REPOSITORY } from '../user-management/domain/repositories/user.repository';
import { PrismaUserRepository } from '../user-management/infrastructure/repositories/prisma-user.repository';
import { ProfessionalRepository, PROFESSIONAL_REPOSITORY } from '../service/domain/repositories/professional.repository';
import { PrismaProfessionalRepository } from '../service/infrastructure/repositories/prisma-professional.repository';
import { UserManagementModule } from '../user-management/user-management.module';
import { ServiceModule } from '../service/service.module';

@Module({
  imports: [UserManagementModule, ServiceModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: PROFESSIONAL_REPOSITORY,
      useClass: PrismaProfessionalRepository,
    },
  ],
})
export class AdminModule {}
