import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { FileStorageRepository, FILE_STORAGE_REPOSITORY } from '../../domain/repositories/file-storage.repository';
import { FileEntity } from '../../domain/entities/file.entity';
import { FileCategory, FileCategoryVO } from '../../domain/value-objects/file-category.vo';
import { FileTypeVO } from '../../domain/value-objects/file-type.vo';
import { FileSizeVO } from '../../domain/value-objects/file-size.vo';
import { UploadFileDto } from '../dto/upload-file.dto';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { RequestService } from '../../../requests/application/services/request.service';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(FILE_STORAGE_REPOSITORY)
    private readonly fileStorageRepository: FileStorageRepository,
    private readonly requestService: RequestService,
    private readonly professionalService: ProfessionalService,
  ) {}

  async uploadFile(
    file: Express.Multer.File | undefined,
    uploadDto: UploadFileDto,
    userId: string,
  ): Promise<FileEntity> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const fileType = new FileTypeVO(file.mimetype, uploadDto.category);
    const fileSize = new FileSizeVO(file.size, fileType.getMaxSize());

    // Validate requestId if provided
    if (uploadDto.requestId) {
      const request = await this.requestService.findById(uploadDto.requestId);
      
      // Check if user is the client who created the request
      const isClient = request.clientId === userId;
      
      // Check if user is the professional assigned to the request
      let isProfessional = false;
      if (request.professionalId) {
        try {
          const professional = await this.professionalService.findByUserId(userId);
          isProfessional = professional.id === request.professionalId;
        } catch {
          // User doesn't have a professional profile
          isProfessional = false;
        }
      }
      
      // Verify user is either the client or the assigned professional
      if (!isClient && !isProfessional) {
        throw new ForbiddenException('Only the client or assigned professional can upload photos to this request');
      }
    }

    // Upload file
    const fileEntity = await this.fileStorageRepository.upload(file.buffer, {
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      category: uploadDto.category,
      ownerId: userId,
      requestId: uploadDto.requestId,
    });

    return fileEntity;
  }

  async getFile(filePath: string): Promise<FileEntity> {
    const file = await this.fileStorageRepository.findByPath(filePath);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  async deleteFile(filePath: string, userId: string, isAdmin: boolean): Promise<void> {
    const file = await this.fileStorageRepository.findByPath(filePath);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Admin can delete any file
    if (isAdmin) {
      await this.fileStorageRepository.delete(filePath);
      return;
    }

    // Check ownership
    if (!file.belongsTo(userId)) {
      throw new ForbiddenException('You can only delete your own files');
    }

    await this.fileStorageRepository.delete(filePath);
  }

  async canAccessFile(
    filePath: string,
    userId: string | null,
    isAdmin: boolean,
  ): Promise<boolean> {
    const file = await this.fileStorageRepository.findByPath(filePath);
    if (!file) {
      return false;
    }

    // Admin can access all files
    if (isAdmin) {
      return true;
    }

    const categoryVO = new FileCategoryVO(file.category);

    // Public files are accessible to everyone
    if (categoryVO.isPublic()) {
      return true;
    }

    // Private files require authentication
    if (!userId) {
      return false;
    }

    // Owner can always access
    if (file.belongsTo(userId)) {
      return true;
    }

    // For request photos, check access based on request type
    if (file.category === FileCategory.REQUEST_PHOTO && file.requestId) {
      try {
        const request = await this.requestService.findById(file.requestId);
        
        // PUBLIC REQUESTS: All logged-in users can see photos
        if (request.isPublic) {
          return true; // userId is already verified as not null above
        }
        
        // DIRECT REQUESTS: Only client and assigned specialist can see photos
        // Check if user is the client (owner)
        if (request.clientId === userId) {
          return true;
        }
        
        // Check if user is the assigned professional
        if (request.professionalId) {
          try {
            const professional = await this.professionalService.findByUserId(userId);
            if (professional.id === request.professionalId) {
              return true;
            }
          } catch {
            // User doesn't have a professional profile
          }
        }
        
        return false;
      } catch {
        return false;
      }
    }

    return false;
  }
}

