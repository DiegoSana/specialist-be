import { Module } from '@nestjs/common';
import { ServiceController } from './presentation/service.controller';
// Import new bounded context modules
import { ProfilesModule } from '../profiles/profiles.module';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [ProfilesModule, RequestsModule],
  controllers: [ServiceController],
})
export class ServiceModule {}
