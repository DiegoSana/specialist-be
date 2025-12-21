import { FileEntity } from '../entities/file.entity';
import { FileCategory } from '../value-objects/file-category.vo';

/**
 * Puerto de infraestructura (no es repositorio de aggregate).
 * Define operaciones de almacenamiento de blobs + metadata mínima.
 *
 * Mantengo el nombre histórico `FileStorageRepository` como alias por compatibilidad.
 */
export interface FileStoragePort {
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

// Backward-compatible alias
export type FileStorageRepository = FileStoragePort;

// Token for dependency injection
export const FILE_STORAGE_REPOSITORY = Symbol('FileStorageRepository');
