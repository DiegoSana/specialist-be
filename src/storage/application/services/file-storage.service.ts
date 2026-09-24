import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import {
  FileStorageRepository,
  FILE_STORAGE_REPOSITORY,
} from '../../domain/repositories/file-storage.repository';
import { FileEntity } from '../../domain/entities/file.entity';
import {
  FileCategory,
  FileCategoryVO,
} from '../../domain/value-objects/file-category.vo';
import { FileTypeVO } from '../../domain/value-objects/file-type.vo';
import { FileSizeVO } from '../../domain/value-objects/file-size.vo';
import { UploadFileDto } from '../dto/upload-file.dto';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { RequestService } from '../../../requests/application/services/request.service';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(FILE_STORAGE_REPOSITORY)
    private readonly fileStorageRepository: FileStorageRepository,
    private readonly requestService: RequestService,
    private readonly professionalService: ProfessionalService,
    private readonly companyService: CompanyService,
  ) {}

  async uploadFile(
    file: Express.Multer.File | undefined,
    uploadDto: UploadFileDto,
    userId: string,
  ): Promise<FileEntity> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type. FileTypeVO/FileSizeVO are domain value objects and correctly throw a
    // plain Error rather than a Nest exception (domain must stay HTTP-agnostic) - translate that
    // into a proper 400 here at the application boundary instead of letting it bubble unhandled
    // into a raw 500.
    try {
      const fileType = new FileTypeVO(file.mimetype, uploadDto.category);
      new FileSizeVO(file.size, fileType.getMaxSize());
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }

    // Validate requestId if provided
    if (uploadDto.requestId) {
      const request = await this.requestService.findById(uploadDto.requestId);
      // Check if user is the client who created the request
      const isClient = request.clientId === userId;

      // Check if user is the service provider assigned to the request
      let isProfessional = false;
      if (request.providerId) {
        try {
          const professional =
            await this.professionalService.findByUserId(userId);
          isProfessional =
            professional.serviceProviderId === request.providerId;
        } catch {
          // User doesn't have a professional profile
          isProfessional = false;
        }
      }

      // Verify user is either the client or the assigned professional
      if (!isClient && !isProfessional) {
        throw new ForbiddenException(
          'Only the client or assigned professional can upload photos to this request',
        );
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

  async deleteFile(
    filePath: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
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

    // For request photos/videos:
    // - A public (marketplace) request with no provider assigned yet is visible to any
    //   authenticated user (see the isPublic/!providerId check below) - specialists need
    //   to see photos to size/quote the job before expressing interest.
    // - Once a provider is assigned, or for a direct request (isPublic === false) at any
    //   time, access is restricted to the client, the assigned provider, and admins -
    //   never the general public, and never a specialist who merely expressed interest
    //   but wasn't chosen.
    if (file.category === FileCategory.REQUEST_PHOTO && file.requestId) {
      try {
        const request = await this.requestService.findById(file.requestId);

        // Check if user is the client (owner)
        if (request.clientId === userId) {
          return true;
        }

        // While a public (marketplace) request has no assigned provider yet, any
        // authenticated user may view its photos/videos - specialists need to see them
        // to size/quote the job before expressing interest. This window closes the
        // moment a provider is assigned (see below): from then on only the client, the
        // assigned provider, and admins may access the files, even though isPublic is
        // still true. Direct requests (isPublic === false) never get this bypass.
        if (request.isPublic && !request.providerId) {
          return true;
        }

        // Check if user is the assigned service provider (professional or company).
        // request.providerId is the ServiceProvider actually chosen/assigned to the
        // request - not merely a specialist who expressed interest before being chosen.
        if (request.providerId) {
          try {
            const professional =
              await this.professionalService.findByUserId(userId);
            if (professional.serviceProviderId === request.providerId) {
              return true;
            }
          } catch {
            // User doesn't have a professional profile
          }

          try {
            const company = await this.companyService.findByUserId(userId);
            if (company.serviceProviderId === request.providerId) {
              return true;
            }
          } catch {
            // User doesn't have a company profile
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
