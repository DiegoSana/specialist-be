import { Module } from '@nestjs/common';
import { ContactController } from './presentation/contact.controller';
import { ContactService } from './application/contact.service';
import { ContactRepository, CONTACT_REPOSITORY } from './domain/repositories/contact.repository';
import { PrismaContactRepository } from './infrastructure/repositories/prisma-contact.repository';
// Import new bounded context module
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
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
