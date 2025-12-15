import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserManagementModule } from './user-management/user-management.module';
import { ServiceModule } from './service/service.module';
import { ReputationModule } from './reputation/reputation.module';
import { ContactModule } from './contact/contact.module';
import { AdminModule } from './admin/admin.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    UserManagementModule,
    ServiceModule,
    ReputationModule,
    ContactModule,
    AdminModule,
    StorageModule,
  ],
})
export class AppModule {}
