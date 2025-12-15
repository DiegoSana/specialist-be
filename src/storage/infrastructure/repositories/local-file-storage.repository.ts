import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { FileStorageRepository } from '../../domain/repositories/file-storage.repository';
import { FileEntity } from '../../domain/entities/file.entity';
import { FileCategory, FileCategoryVO } from '../../domain/value-objects/file-category.vo';
import { FileTypeVO } from '../../domain/value-objects/file-type.vo';
import { FileSizeVO } from '../../domain/value-objects/file-size.vo';

@Injectable()
export class LocalFileStorageRepository implements FileStorageRepository {
  private readonly storagePath: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath = this.configService.get<string>('STORAGE_LOCAL_PATH', './uploads');
    this.baseUrl = this.configService.get<string>('STORAGE_BASE_URL', 'http://localhost:5000/api/storage');
  }

  async upload(
    file: Buffer,
    metadata: {
      originalFilename: string;
      mimeType: string;
      category: FileCategory;
      ownerId?: string;
      requestId?: string;
    },
  ): Promise<FileEntity> {
    // Validate file type
    const fileType = new FileTypeVO(metadata.mimeType, metadata.category);
    const fileSize = new FileSizeVO(file.length, fileType.getMaxSize());
    const categoryVO = new FileCategoryVO(metadata.category);

    // Generate unique filename
    const extension = fileType.getExtension();
    const storedFilename = `${randomUUID()}.${extension}`;

    // Build storage path
    const categoryPath = categoryVO.getStoragePath();
    let relativePath: string;

    if (metadata.category === FileCategory.PROFILE_PICTURE && metadata.ownerId) {
      relativePath = path.join(categoryPath, metadata.ownerId, storedFilename);
    } else if (
      (metadata.category === FileCategory.PROJECT_IMAGE ||
        metadata.category === FileCategory.PROJECT_VIDEO) &&
      metadata.ownerId
    ) {
      relativePath = path.join(categoryPath, metadata.ownerId, storedFilename);
    } else if (metadata.category === FileCategory.REQUEST_PHOTO && metadata.requestId) {
      relativePath = path.join(categoryPath, metadata.requestId, storedFilename);
    } else {
      relativePath = path.join(categoryPath, storedFilename);
    }

    const fullPath = path.join(this.storagePath, relativePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file
    await fs.writeFile(fullPath, file);

    // Generate URL
    const url = this.buildUrl(relativePath);

    // Create file entity
    const fileEntity = new FileEntity(
      randomUUID(),
      metadata.originalFilename,
      storedFilename,
      relativePath,
      url,
      metadata.category,
      metadata.mimeType,
      file.length,
      metadata.ownerId || null,
      metadata.requestId || null,
      new Date(),
      new Date(),
    );

    return fileEntity;
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.storagePath, filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getUrl(filePath: string): Promise<string> {
    return this.buildUrl(filePath);
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.storagePath, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async findByPath(filePath: string): Promise<FileEntity | null> {
    // In a real implementation, you might want to store metadata in a database
    // For now, we'll just check if the file exists
    const exists = await this.exists(filePath);
    if (!exists) {
      return null;
    }

    // Extract metadata from path
    // Normalize path separators to forward slashes for consistency
    const normalizedPath = filePath.replace(/\\/g, '/');
    const stats = await fs.stat(path.join(this.storagePath, filePath));
    const pathParts = normalizedPath.split('/');
    const filename = pathParts[pathParts.length - 1];

    // Try to determine category from path
    let category: FileCategory = FileCategory.PROFILE_PICTURE;
    let ownerId: string | null = null;
    let requestId: string | null = null;

    if (normalizedPath.includes('projects/images')) {
      category = FileCategory.PROJECT_IMAGE;
      // Extract ownerId from path: public/projects/images/{ownerId}/{filename}
      const projectsIndex = pathParts.indexOf('projects');
      if (projectsIndex >= 0 && pathParts.length > projectsIndex + 2) {
        ownerId = pathParts[projectsIndex + 2];
      }
    } else if (normalizedPath.includes('projects/videos')) {
      category = FileCategory.PROJECT_VIDEO;
      // Extract ownerId from path: public/projects/videos/{ownerId}/{filename}
      const projectsIndex = pathParts.indexOf('projects');
      if (projectsIndex >= 0 && pathParts.length > projectsIndex + 2) {
        ownerId = pathParts[projectsIndex + 2];
      }
    } else if (normalizedPath.includes('profile-pictures')) {
      category = FileCategory.PROFILE_PICTURE;
      // Extract ownerId from path: public/profile-pictures/{ownerId}/{filename}
      const profileIndex = pathParts.indexOf('profile-pictures');
      if (profileIndex >= 0 && pathParts.length > profileIndex + 1) {
        ownerId = pathParts[profileIndex + 1];
      }
    } else if (normalizedPath.includes('requests')) {
      category = FileCategory.REQUEST_PHOTO;
      // Extract requestId from path: private/requests/{requestId}/{filename}
      const requestsIndex = pathParts.indexOf('requests');
      if (requestsIndex >= 0 && pathParts.length > requestsIndex + 1) {
        requestId = pathParts[requestsIndex + 1];
      }
    }

    return new FileEntity(
      randomUUID(), // In real implementation, this would come from DB
      filename,
      filename,
      filePath,
      this.buildUrl(filePath),
      category,
      'application/octet-stream', // Would need to detect from file
      stats.size,
      ownerId,
      requestId,
      stats.birthtime,
      stats.mtime,
    );
  }

  async findById(id: string): Promise<FileEntity | null> {
    // In a real implementation, this would query a database
    // For now, we'll return null as we don't have a DB for file metadata
    return null;
  }

  private buildUrl(relativePath: string): string {
    // Replace backslashes with forward slashes for URLs
    const urlPath = relativePath.replace(/\\/g, '/');
    // Ensure baseUrl doesn't end with / and urlPath doesn't start with /
    const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
    const cleanUrlPath = urlPath.replace(/^\//, '');
    
    // Build URL by properly encoding path segments
    // Split the path and encode each segment individually
    const pathSegments = cleanUrlPath.split('/').filter(segment => segment.length > 0);
    const encodedSegments = pathSegments.map(segment => {
      // Only encode if the segment contains characters that need encoding
      // UUIDs and simple filenames should be fine, but encode to be safe
      try {
        // Try to decode first to see if it's already encoded
        const decoded = decodeURIComponent(segment);
        // If decoding works and result is same, it wasn't encoded
        // Encode it to ensure it's properly formatted
        return encodeURIComponent(segment);
      } catch {
        // If decode fails, it might already be encoded or have special chars
        return encodeURIComponent(segment);
      }
    });
    
    const encodedPath = encodedSegments.join('/');
    const fullUrl = `${cleanBaseUrl}/${encodedPath}`;
    
    // Validate and return properly formatted URL
    try {
      const url = new URL(fullUrl);
      return url.toString();
    } catch (error) {
      // If URL construction fails, try without encoding
      const simpleUrl = `${cleanBaseUrl}/${cleanUrlPath}`;
      try {
        const url = new URL(simpleUrl);
        return url.toString();
      } catch (e) {
        // Last resort: return the encoded URL even if validation fails
        return fullUrl;
      }
    }
  }
}

