import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileStorageController } from './presentation/file-storage.controller';
import { FileStorageService } from './application/services/file-storage.service';
import { FILE_STORAGE_REPOSITORY } from './domain/repositories/file-storage.repository';
import { LocalFileStorageRepository } from './infrastructure/repositories/local-file-storage.repository';
import { FileAccessGuard } from './presentation/guards/file-access.guard';
// Import new bounded context modules
import { ProfilesModule } from '../profiles/profiles.module';
import { RequestsModule } from '../requests/requests.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [ConfigModule, ProfilesModule, RequestsModule, IdentityModule],
  controllers: [FileStorageController],
  providers: [
    FileStorageService,
    FileAccessGuard,
    {
      provide: FILE_STORAGE_REPOSITORY,
      useClass: LocalFileStorageRepository,
    },
  ],
  exports: [FileStorageService],
})
export class StorageModule {}
