import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileStorageController } from './presentation/file-storage.controller';
import { FileStorageService } from './application/services/file-storage.service';
import {
  FileStorageRepository,
  FILE_STORAGE_REPOSITORY,
} from './domain/repositories/file-storage.repository';
import { LocalFileStorageRepository } from './infrastructure/repositories/local-file-storage.repository';
import { FileAccessGuard } from './presentation/guards/file-access.guard';
import { ServiceModule } from '../service/service.module';

@Module({
  imports: [ConfigModule, ServiceModule],
  controllers: [FileStorageController],
  providers: [
    FileStorageService,
    FileAccessGuard,
    {
      provide: FILE_STORAGE_REPOSITORY,
      useClass: LocalFileStorageRepository,
    },
  ],
  exports: [FileStorageService, FILE_STORAGE_REPOSITORY],
})
export class StorageModule {}

