import { Module } from '@nestjs/common';
import { ContactController } from './presentation/contact.controller';
import { ContactService } from './application/contact.service';
import { ContactRepository, CONTACT_REPOSITORY } from './domain/repositories/contact.repository';
import { PrismaContactRepository } from './infrastructure/repositories/prisma-contact.repository';
import { UserManagementModule } from '../user-management/user-management.module';

@Module({
  imports: [UserManagementModule],
  controllers: [ContactController],
  providers: [
    ContactService,
    {
      provide: CONTACT_REPOSITORY,
      useClass: PrismaContactRepository,
    },
  ],
})
export class ContactModule {}
