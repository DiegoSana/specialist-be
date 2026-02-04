import { Module } from '@nestjs/common';
import { AdminService } from './application/admin.service';
import { AdminController } from './presentation/admin.controller';
// Import bounded context modules
import { IdentityModule } from '../identity/identity.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [IdentityModule, ProfilesModule, RequestsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
