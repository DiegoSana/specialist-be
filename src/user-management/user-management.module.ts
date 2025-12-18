import { Module } from '@nestjs/common';
import { UserManagementController } from './presentation/user-management.controller';
import { AuthenticationController } from './presentation/authentication.controller';
// Import new bounded context modules
import { IdentityModule } from '../identity/identity.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [IdentityModule, ProfilesModule],
  controllers: [UserManagementController, AuthenticationController],
})
export class UserManagementModule {}
