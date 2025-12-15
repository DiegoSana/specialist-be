import { FileEntity } from '../entities/file.entity';
import { FileCategory } from '../value-objects/file-category.vo';

export interface FileStorageRepository {
  upload(
    file: Buffer,
    metadata: {
      originalFilename: string;
      mimeType: string;
      category: FileCategory;
      ownerId?: string;
      requestId?: string;
    },
  ): Promise<FileEntity>;

  delete(filePath: string): Promise<void>;

  getUrl(filePath: string): Promise<string>;

  exists(filePath: string): Promise<boolean>;

  findByPath(filePath: string): Promise<FileEntity | null>;

  findById(id: string): Promise<FileEntity | null>;
}

// Token for dependency injection
export const FILE_STORAGE_REPOSITORY = Symbol('FileStorageRepository');

