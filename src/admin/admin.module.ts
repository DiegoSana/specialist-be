import { Module } from '@nestjs/common';
import { AdminService } from './application/admin.service';
import { AdminController } from './presentation/admin.controller';
// Import new bounded context modules
import { IdentityModule } from '../identity/identity.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [IdentityModule, ProfilesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
