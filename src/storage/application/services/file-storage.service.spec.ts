import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { FILE_STORAGE_REPOSITORY } from '../../domain/repositories/file-storage.repository';
import { RequestService } from '../../../requests/application/services/request.service';
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';
import {
  createMockRequest,
  createMockProfessional,
} from '../../../__mocks__/test-utils';
import { FileCategory } from '../../domain/value-objects/file-category.vo';

describe('FileStorageService', () => {
  let service: FileStorageService;
  let mockFileStorageRepository: any;
  let mockRequestService: any;
  let mockProfessionalService: any;
  let mockCompanyService: any;

  beforeEach(async () => {
    mockFileStorageRepository = {
      upload: jest.fn(),
      findByPath: jest.fn(),
      delete: jest.fn(),
    };

    mockRequestService = {
      findById: jest.fn(),
    };

    mockProfessionalService = {
      findByUserId: jest.fn(),
    };

    mockCompanyService = {
      findByUserId: jest.fn().mockRejectedValue(new Error('not a company')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        {
          provide: FILE_STORAGE_REPOSITORY,
          useValue: mockFileStorageRepository,
        },
        { provide: RequestService, useValue: mockRequestService },
        { provide: ProfessionalService, useValue: mockProfessionalService },
        { provide: CompanyService, useValue: mockCompanyService },
      ],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockFile: Express.Multer.File = {
      buffer: Buffer.from('test'),
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('should throw BadRequestException when no file provided', async () => {
      await expect(
        service.uploadFile(
          undefined,
          { category: FileCategory.PROFILE_PICTURE },
          'user-123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully upload a file without requestId', async () => {
      const uploadedFile = {
        id: 'file-123',
        path: 'uploads/file.jpg',
        category: FileCategory.PROFILE_PICTURE,
        ownerId: 'user-123',
      };

      mockFileStorageRepository.upload.mockResolvedValue(uploadedFile);

      const result = await service.uploadFile(
        mockFile,
        { category: FileCategory.PROFILE_PICTURE },
        'user-123',
      );

      expect(result).toEqual(uploadedFile);
      expect(mockFileStorageRepository.upload).toHaveBeenCalled();
    });

    it('should allow a video upload for the request-photo category', async () => {
      const mockVideoFile: Express.Multer.File = {
        ...mockFile,
        originalname: 'test.mp4',
        mimetype: 'video/mp4',
        size: 1024,
      };
      const uploadedFile = {
        id: 'file-456',
        path: 'uploads/file.mp4',
        category: FileCategory.REQUEST_PHOTO,
        ownerId: 'user-123',
      };

      mockFileStorageRepository.upload.mockResolvedValue(uploadedFile);

      const result = await service.uploadFile(
        mockVideoFile,
        { category: FileCategory.REQUEST_PHOTO },
        'user-123',
      );

      expect(result).toEqual(uploadedFile);
    });

    it('should throw BadRequestException (not a raw 500) for a mimetype not allowed by the category', async () => {
      const mockVideoFile: Express.Multer.File = {
        ...mockFile,
        originalname: 'test.mp4',
        mimetype: 'video/mp4',
        size: 1024,
      };

      await expect(
        service.uploadFile(
          mockVideoFile,
          { category: FileCategory.PROFILE_PICTURE },
          'user-123',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockFileStorageRepository.upload).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when the file exceeds the size cap for its type', async () => {
      const oversizedImage: Express.Multer.File = {
        ...mockFile,
        size: 11 * 1024 * 1024, // over the 10MB image cap
      };

      await expect(
        service.uploadFile(
          oversizedImage,
          { category: FileCategory.PROFILE_PICTURE },
          'user-123',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockFileStorageRepository.upload).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when request not found', async () => {
      mockRequestService.findById.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(
        service.uploadFile(
          mockFile,
          { category: FileCategory.REQUEST_PHOTO, requestId: 'non-existent' },
          'user-123',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow client to upload to their own request', async () => {
      const request = createMockRequest({
        id: 'req-123',
        clientId: 'user-123',
        providerId: 'service-provider-123',
      });

      mockRequestService.findById.mockResolvedValue(request);
      mockProfessionalService.findByUserId.mockResolvedValue(null); // Client is not a professional
      mockFileStorageRepository.upload.mockResolvedValue({ id: 'file-123' });

      const result = await service.uploadFile(
        mockFile,
        { category: FileCategory.REQUEST_PHOTO, requestId: 'req-123' },
        'user-123', // Same as clientId
      );

      expect(result).toBeDefined();
    });

    it('should allow assigned professional to upload to request', async () => {
      const request = createMockRequest({
        id: 'req-123',
        clientId: 'other-user',
        providerId: 'service-provider-123',
      });
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'professional-user',
      });

      mockRequestService.findById.mockResolvedValue(request);
      mockProfessionalService.findByUserId.mockResolvedValue(professional);
      mockFileStorageRepository.upload.mockResolvedValue({ id: 'file-123' });

      const result = await service.uploadFile(
        mockFile,
        { category: FileCategory.REQUEST_PHOTO, requestId: 'req-123' },
        'professional-user', // Professional's userId
      );

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for unauthorized upload to request', async () => {
      const request = createMockRequest({
        id: 'req-123',
        clientId: 'client-user',
        providerId: 'service-provider-123',
      });

      mockRequestService.findById.mockResolvedValue(request);
      mockProfessionalService.findByUserId.mockResolvedValue(null); // Not a professional

      await expect(
        service.uploadFile(
          mockFile,
          { category: FileCategory.REQUEST_PHOTO, requestId: 'req-123' },
          'random-user', // Neither client nor assigned professional
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('canAccessFile', () => {
    describe('admin access', () => {
      it('should allow admin to access any file', async () => {
        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'other-user',
        });

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'admin-user',
          true,
        );

        expect(result).toBe(true);
      });
    });

    describe('public files', () => {
      it('should allow anyone to access public files', async () => {
        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.PROFILE_PICTURE,
          ownerId: 'owner',
        });

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          null,
          false,
        );

        expect(result).toBe(true);
      });

      it('should allow access to project images', async () => {
        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.PROJECT_IMAGE,
          ownerId: 'owner',
        });

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          null,
          false,
        );

        expect(result).toBe(true);
      });
    });

    describe('private files - owner access', () => {
      it('should allow owner to access their own files', async () => {
        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'user-123',
          requestId: null,
          belongsTo: (userId: string) => userId === 'user-123',
        });

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'user-123',
          false,
        );

        expect(result).toBe(true);
      });

      it('should deny access to non-owners for private files without request', async () => {
        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'other-user',
          requestId: null,
          belongsTo: (userId: string) => userId === 'other-user',
        });

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'user-123',
          false,
        );

        expect(result).toBe(false);
      });
    });

    describe('request photos - PUBLIC (marketplace) requests, provider already assigned', () => {
      // Once a provider has been assigned to a PUBLIC (marketplace) request, its
      // photos/videos become private again, same as a DIRECT request: only the client,
      // the assigned provider, and admins may access them - even though isPublic is
      // still true. Every other specialist, including one who expressed interest but
      // wasn't chosen, loses access at that point.
      it('should deny a random logged-in user (not client, not assigned) from PUBLIC request photos once a provider is assigned', async () => {
        const publicRequest = createMockRequest({
          id: 'req-123',
          isPublic: true,
          clientId: 'client-user',
          providerId: 'service-provider-chosen',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: (userId: string) => userId === 'client-user',
        });
        mockRequestService.findById.mockResolvedValue(publicRequest);
        mockProfessionalService.findByUserId.mockRejectedValue(
          new Error('not a professional'),
        );

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'random-user',
          false,
        );

        expect(result).toBe(false);
      });

      it('should deny a specialist who expressed interest but was not chosen from PUBLIC request photos', async () => {
        const publicRequest = createMockRequest({
          id: 'req-123',
          isPublic: true,
          clientId: 'client-user',
          providerId: 'service-provider-chosen',
        });
        const interestedProfessional = createMockProfessional({
          id: 'prof-interested',
          userId: 'interested-user',
        });
        (interestedProfessional as any).serviceProviderId =
          'service-provider-interested'; // not the one assigned to the request

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(publicRequest);
        mockProfessionalService.findByUserId.mockResolvedValue(
          interestedProfessional,
        );

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'interested-user',
          false,
        );

        expect(result).toBe(false);
      });

      it('should allow the client to access PUBLIC request photos', async () => {
        const publicRequest = createMockRequest({
          id: 'req-123',
          isPublic: true,
          clientId: 'client-user',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: (userId: string) => userId === 'client-user',
        });
        mockRequestService.findById.mockResolvedValue(publicRequest);

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'client-user',
          false,
        );

        expect(result).toBe(true);
      });

      it('should allow the chosen professional to access PUBLIC request photos', async () => {
        const publicRequest = createMockRequest({
          id: 'req-123',
          isPublic: true,
          clientId: 'client-user',
          providerId: 'service-provider-123',
        });
        const professional = createMockProfessional({
          id: 'prof-123',
          userId: 'professional-user',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(publicRequest);
        mockProfessionalService.findByUserId.mockResolvedValue(professional);

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'professional-user',
          false,
        );

        expect(result).toBe(true);
      });

      it('should deny non-logged-in users from PUBLIC request photos', async () => {
        const publicRequest = createMockRequest({
          id: 'req-123',
          isPublic: true,
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(publicRequest);

        // No user (not logged in)
        const result = await service.canAccessFile(
          'uploads/file.jpg',
          null,
          false,
        );

        expect(result).toBe(false);
      });
    });

    describe('request photos - PUBLIC (marketplace) requests, no provider assigned yet', () => {
      // While a public request is still open (no provider chosen yet), specialists need
      // to see its photos/videos to size/quote the job before deciding whether to express
      // interest. Any authenticated user gets access during this window - it closes the
      // moment a provider is assigned (see the sibling describe block above).
      it('should allow a random authenticated user to access PUBLIC request photos while no provider is assigned', async () => {
        const openPublicRequest = createMockRequest({
          id: 'req-123',
          isPublic: true,
          clientId: 'client-user',
          providerId: null,
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(openPublicRequest);

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'random-user',
          false,
        );

        expect(result).toBe(true);
      });

      it('should allow a specialist who expressed interest (but was not chosen, since no one has been chosen yet) to access PUBLIC request photos while no provider is assigned', async () => {
        const openPublicRequest = createMockRequest({
          id: 'req-123',
          isPublic: true,
          clientId: 'client-user',
          providerId: null,
        });
        const interestedProfessional = createMockProfessional({
          id: 'prof-interested',
          userId: 'interested-user',
        });
        (interestedProfessional as any).serviceProviderId =
          'service-provider-interested';

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(openPublicRequest);
        mockProfessionalService.findByUserId.mockResolvedValue(
          interestedProfessional,
        );

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'interested-user',
          false,
        );

        expect(result).toBe(true);
      });

      it('should deny non-logged-in users from PUBLIC request photos while no provider is assigned', async () => {
        const openPublicRequest = createMockRequest({
          id: 'req-123',
          isPublic: true,
          clientId: 'client-user',
          providerId: null,
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(openPublicRequest);

        // No user (not logged in)
        const result = await service.canAccessFile(
          'uploads/file.jpg',
          null,
          false,
        );

        expect(result).toBe(false);
      });
    });

    describe('request photos - assigned company as provider', () => {
      it('should allow the assigned company (user acting as its owner) to access request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          providerId: 'service-provider-company-123',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(directRequest);
        mockProfessionalService.findByUserId.mockRejectedValue(
          new Error('not a professional'),
        );
        mockCompanyService.findByUserId.mockResolvedValue({
          serviceProviderId: 'service-provider-company-123',
        });

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'company-owner-user',
          false,
        );

        expect(result).toBe(true);
      });

      it('should deny a different company from request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          providerId: 'service-provider-company-123',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(directRequest);
        mockProfessionalService.findByUserId.mockRejectedValue(
          new Error('not a professional'),
        );
        mockCompanyService.findByUserId.mockResolvedValue({
          serviceProviderId: 'service-provider-company-999',
        });

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'other-company-owner-user',
          false,
        );

        expect(result).toBe(false);
      });
    });

    describe('request photos - DIRECT (private) requests', () => {
      it('should allow client to access DIRECT request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          providerId: 'service-provider-123',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: (userId: string) => userId === 'client-user',
        });
        mockRequestService.findById.mockResolvedValue(directRequest);

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'client-user',
          false,
        );

        expect(result).toBe(true);
      });

      it('should allow assigned professional to access DIRECT request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          providerId: 'service-provider-123',
        });
        const professional = createMockProfessional({
          id: 'prof-123',
          userId: 'professional-user',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false, // Not the owner
        });
        mockRequestService.findById.mockResolvedValue(directRequest);
        mockProfessionalService.findByUserId.mockResolvedValue(professional);

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'professional-user',
          false,
        );

        expect(result).toBe(true);
      });

      it('should deny other users from DIRECT request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          providerId: 'service-provider-123',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(directRequest);
        mockProfessionalService.findByUserId.mockResolvedValue(null);

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'random-user',
          false,
        );

        expect(result).toBe(false);
      });

      it('should deny different professional from DIRECT request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          providerId: 'service-provider-123', // Assigned to prof-123
        });
        const differentProfessional = createMockProfessional({
          id: 'prof-999', // Different professional
          userId: 'different-professional-user',
        });
        // Override the serviceProviderId to be different
        (differentProfessional as any).serviceProviderId =
          'service-provider-999';

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestService.findById.mockResolvedValue(directRequest);
        mockProfessionalService.findByUserId.mockResolvedValue(
          differentProfessional,
        );

        const result = await service.canAccessFile(
          'uploads/file.jpg',
          'different-professional-user',
          false,
        );

        expect(result).toBe(false);
      });
    });

    describe('file not found', () => {
      it('should return false when file not found', async () => {
        mockFileStorageRepository.findByPath.mockResolvedValue(null);

        const result = await service.canAccessFile(
          'non-existent.jpg',
          'user-123',
          false,
        );

        expect(result).toBe(false);
      });
    });
  });

  describe('deleteFile', () => {
    it('should allow admin to delete any file', async () => {
      mockFileStorageRepository.findByPath.mockResolvedValue({
        category: FileCategory.REQUEST_PHOTO,
        ownerId: 'other-user',
        belongsTo: () => false,
      });

      await service.deleteFile('uploads/file.jpg', 'admin-user', true);

      expect(mockFileStorageRepository.delete).toHaveBeenCalledWith(
        'uploads/file.jpg',
      );
    });

    it('should allow owner to delete their own file', async () => {
      mockFileStorageRepository.findByPath.mockResolvedValue({
        category: FileCategory.PROFILE_PICTURE,
        ownerId: 'user-123',
        belongsTo: (userId: string) => userId === 'user-123',
      });

      await service.deleteFile('uploads/file.jpg', 'user-123', false);

      expect(mockFileStorageRepository.delete).toHaveBeenCalledWith(
        'uploads/file.jpg',
      );
    });

    it('should throw NotFoundException when file not found', async () => {
      mockFileStorageRepository.findByPath.mockResolvedValue(null);

      await expect(
        service.deleteFile('non-existent.jpg', 'user-123', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when non-owner tries to delete', async () => {
      mockFileStorageRepository.findByPath.mockResolvedValue({
        category: FileCategory.PROFILE_PICTURE,
        ownerId: 'other-user',
        belongsTo: (userId: string) => userId === 'other-user',
      });

      await expect(
        service.deleteFile('uploads/file.jpg', 'user-123', false),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getFile', () => {
    it('should return file when found', async () => {
      const file = {
        id: 'file-123',
        path: 'uploads/file.jpg',
        category: FileCategory.PROFILE_PICTURE,
      };
      mockFileStorageRepository.findByPath.mockResolvedValue(file);

      const result = await service.getFile('uploads/file.jpg');

      expect(result).toEqual(file);
    });

    it('should throw NotFoundException when file not found', async () => {
      mockFileStorageRepository.findByPath.mockResolvedValue(null);

      await expect(service.getFile('non-existent.jpg')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
