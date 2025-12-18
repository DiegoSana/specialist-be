import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { FILE_STORAGE_REPOSITORY } from '../../domain/repositories/file-storage.repository';
import { REQUEST_REPOSITORY } from '../../../requests/domain/repositories/request.repository';
import { PROFESSIONAL_REPOSITORY } from '../../../profiles/domain/repositories/professional.repository';
import { createMockRequest, createMockProfessional } from '../../../__mocks__/test-utils';
import { FileCategory } from '../../domain/value-objects/file-category.vo';
import { RequestStatus } from '@prisma/client';

describe('FileStorageService', () => {
  let service: FileStorageService;
  let mockFileStorageRepository: any;
  let mockRequestRepository: any;
  let mockProfessionalRepository: any;

  beforeEach(async () => {
    mockFileStorageRepository = {
      upload: jest.fn(),
      findByPath: jest.fn(),
      delete: jest.fn(),
    };

    mockRequestRepository = {
      findById: jest.fn(),
    };

    mockProfessionalRepository = {
      findByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        { provide: FILE_STORAGE_REPOSITORY, useValue: mockFileStorageRepository },
        { provide: REQUEST_REPOSITORY, useValue: mockRequestRepository },
        { provide: PROFESSIONAL_REPOSITORY, useValue: mockProfessionalRepository },
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
        service.uploadFile(undefined, { category: FileCategory.PROFILE_PICTURE }, 'user-123'),
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

    it('should throw NotFoundException when request not found', async () => {
      mockRequestRepository.findById.mockResolvedValue(null);

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
        professionalId: 'prof-123',
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(null); // Client is not a professional
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
        professionalId: 'prof-123',
      });
      const professional = createMockProfessional({
        id: 'prof-123',
        userId: 'professional-user',
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(professional);
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
        professionalId: 'prof-123',
      });

      mockRequestRepository.findById.mockResolvedValue(request);
      mockProfessionalRepository.findByUserId.mockResolvedValue(null); // Not a professional

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

        const result = await service.canAccessFile('uploads/file.jpg', 'admin-user', true);

        expect(result).toBe(true);
      });
    });

    describe('public files', () => {
      it('should allow anyone to access public files', async () => {
        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.PROFILE_PICTURE,
          ownerId: 'owner',
        });

        const result = await service.canAccessFile('uploads/file.jpg', null, false);

        expect(result).toBe(true);
      });

      it('should allow access to project images', async () => {
        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.PROJECT_IMAGE,
          ownerId: 'owner',
        });

        const result = await service.canAccessFile('uploads/file.jpg', null, false);

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

        const result = await service.canAccessFile('uploads/file.jpg', 'user-123', false);

        expect(result).toBe(true);
      });

      it('should deny access to non-owners for private files without request', async () => {
        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'other-user',
          requestId: null,
          belongsTo: (userId: string) => userId === 'other-user',
        });

        const result = await service.canAccessFile('uploads/file.jpg', 'user-123', false);

        expect(result).toBe(false);
      });
    });

    describe('request photos - PUBLIC requests', () => {
      it('should allow any logged-in user to access PUBLIC request photos', async () => {
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
        mockRequestRepository.findById.mockResolvedValue(publicRequest);

        // Random logged-in user should have access
        const result = await service.canAccessFile('uploads/file.jpg', 'random-user', false);

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
        mockRequestRepository.findById.mockResolvedValue(publicRequest);

        // No user (not logged in)
        const result = await service.canAccessFile('uploads/file.jpg', null, false);

        expect(result).toBe(false);
      });
    });

    describe('request photos - DIRECT (private) requests', () => {
      it('should allow client to access DIRECT request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          professionalId: 'prof-123',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: (userId: string) => userId === 'client-user',
        });
        mockRequestRepository.findById.mockResolvedValue(directRequest);

        const result = await service.canAccessFile('uploads/file.jpg', 'client-user', false);

        expect(result).toBe(true);
      });

      it('should allow assigned professional to access DIRECT request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          professionalId: 'prof-123',
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
        mockRequestRepository.findById.mockResolvedValue(directRequest);
        mockProfessionalRepository.findByUserId.mockResolvedValue(professional);

        const result = await service.canAccessFile('uploads/file.jpg', 'professional-user', false);

        expect(result).toBe(true);
      });

      it('should deny other users from DIRECT request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          professionalId: 'prof-123',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestRepository.findById.mockResolvedValue(directRequest);
        mockProfessionalRepository.findByUserId.mockResolvedValue(null);

        const result = await service.canAccessFile('uploads/file.jpg', 'random-user', false);

        expect(result).toBe(false);
      });

      it('should deny different professional from DIRECT request photos', async () => {
        const directRequest = createMockRequest({
          id: 'req-123',
          isPublic: false,
          clientId: 'client-user',
          professionalId: 'prof-123', // Assigned to prof-123
        });
        const differentProfessional = createMockProfessional({
          id: 'prof-999', // Different professional
          userId: 'different-professional-user',
        });

        mockFileStorageRepository.findByPath.mockResolvedValue({
          category: FileCategory.REQUEST_PHOTO,
          ownerId: 'client-user',
          requestId: 'req-123',
          belongsTo: () => false,
        });
        mockRequestRepository.findById.mockResolvedValue(directRequest);
        mockProfessionalRepository.findByUserId.mockResolvedValue(differentProfessional);

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

        const result = await service.canAccessFile('non-existent.jpg', 'user-123', false);

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

      expect(mockFileStorageRepository.delete).toHaveBeenCalledWith('uploads/file.jpg');
    });

    it('should allow owner to delete their own file', async () => {
      mockFileStorageRepository.findByPath.mockResolvedValue({
        category: FileCategory.PROFILE_PICTURE,
        ownerId: 'user-123',
        belongsTo: (userId: string) => userId === 'user-123',
      });

      await service.deleteFile('uploads/file.jpg', 'user-123', false);

      expect(mockFileStorageRepository.delete).toHaveBeenCalledWith('uploads/file.jpg');
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

      await expect(service.getFile('non-existent.jpg')).rejects.toThrow(NotFoundException);
    });
  });
});

