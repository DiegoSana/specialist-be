import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UserService } from '../../identity/application/services/user.service';
import { ProfessionalService } from '../../profiles/application/services/professional.service';
import { CompanyService } from '../../profiles/application/services/company.service';
import { RequestService } from '../../requests/application/services/request.service';
import {
  createMockUser,
  createMockProfessional,
} from '../../__mocks__/test-utils';
import { UserStatus, ProfessionalStatus } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let mockUserService: any;
  let mockProfessionalService: any;
  let mockCompanyService: any;
  let mockRequestService: any;

  beforeEach(async () => {
    mockUserService = {
      findById: jest.fn(),
      findByIdOrFail: jest.fn(),
      update: jest.fn(),
      findByIdForUser: jest.fn(),
      updateStatusForUser: jest.fn(),
      getAllUsersForAdmin: jest.fn(),
      getUserStats: jest.fn(),
    };

    mockProfessionalService = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
      getAllProfessionalsForAdmin: jest.fn(),
      getProfessionalByIdForAdmin: jest.fn(),
      getProfessionalStats: jest.fn(),
    };

    mockCompanyService = {
      getAllCompaniesForAdmin: jest.fn(),
      getCompanyByIdForAdmin: jest.fn(),
      updateStatus: jest.fn(),
      getCompanyStats: jest.fn(),
    };

    mockRequestService = {
      getAllRequestsForAdmin: jest.fn(),
      getRequestStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UserService, useValue: mockUserService },
        { provide: ProfessionalService, useValue: mockProfessionalService },
        { provide: CompanyService, useValue: mockCompanyService },
        { provide: RequestService, useValue: mockRequestService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return paginated users', async () => {
      const users = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          firstName: 'User',
          lastName: 'One',
          status: 'ACTIVE',
          createdAt: new Date(),
          client: null,
          professional: null,
        },
        {
          id: 'user-2',
          email: 'user2@test.com',
          firstName: 'User',
          lastName: 'Two',
          status: 'ACTIVE',
          createdAt: new Date(),
          client: { id: 'client-1' },
          professional: null,
        },
      ];

      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: users,
        meta: {
          total: 15,
          page: 1,
          limit: 10,
          totalPages: 2,
        },
      });

      const result = await service.getAllUsers(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(15);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(2);
      expect(mockUserService.getAllUsersForAdmin).toHaveBeenCalledWith(1, 10);
    });

    it('should handle empty results', async () => {
      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });

      const result = await service.getAllUsers(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should apply pagination correctly', async () => {
      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 25,
          page: 3,
          limit: 5,
          totalPages: 5,
        },
      });

      await service.getAllUsers(3, 5);

      expect(mockUserService.getAllUsersForAdmin).toHaveBeenCalledWith(3, 5);
    });

    it('should use default pagination values', async () => {
      mockUserService.getAllUsersForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });

      await service.getAllUsers();

      expect(mockUserService.getAllUsersForAdmin).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('getUserById', () => {
    const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });

    it('should return user when found', async () => {
      const user = createMockUser();
      mockUserService.findByIdForUser.mockResolvedValue(user);

      const result = await service.getUserById('user-123', adminUser);

      expect(result).toEqual(user);
      expect(mockUserService.findByIdForUser).toHaveBeenCalledWith(
        'user-123',
        adminUser,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.findByIdForUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.getUserById('non-existent', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });

    it('should update user status successfully', async () => {
      const updatedUser = createMockUser({ status: UserStatus.SUSPENDED });
      mockUserService.updateStatusForUser.mockResolvedValue(updatedUser);

      const result = await service.updateUserStatus(
        'user-123',
        { status: UserStatus.SUSPENDED },
        adminUser,
      );

      expect(result.status).toBe(UserStatus.SUSPENDED);
      expect(mockUserService.updateStatusForUser).toHaveBeenCalledWith(
        'user-123',
        adminUser,
        UserStatus.SUSPENDED,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.updateStatusForUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.updateUserStatus(
          'non-existent',
          { status: UserStatus.SUSPENDED },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllProfessionals', () => {
    it('should return paginated professionals', async () => {
      const professionals = [
        {
          id: 'prof-1',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'pro1@test.com',
            firstName: 'Pro',
            lastName: 'One',
          },
          trades: [{ trade: { id: 'trade-1', name: 'Electricista' } }],
          createdAt: new Date(),
        },
      ];

      mockProfessionalService.getAllProfessionalsForAdmin.mockResolvedValue({
        data: professionals,
        meta: {
          total: 5,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      const result = await service.getAllProfessionals(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(5);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
      expect(mockProfessionalService.getAllProfessionalsForAdmin).toHaveBeenCalledWith(
        1,
        10,
      );
    });

    it('should handle empty results', async () => {
      mockProfessionalService.getAllProfessionalsForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });

      const result = await service.getAllProfessionals(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should apply pagination correctly', async () => {
      mockProfessionalService.getAllProfessionalsForAdmin.mockResolvedValue({
        data: [],
        meta: {
          total: 30,
          page: 2,
          limit: 15,
          totalPages: 2,
        },
      });

      await service.getAllProfessionals(2, 15);

      expect(mockProfessionalService.getAllProfessionalsForAdmin).toHaveBeenCalledWith(
        2,
        15,
      );
    });
  });

  describe('updateProfessionalStatus', () => {
    const adminUser = createMockUser({ id: 'admin-123', isAdmin: true });

    it('should update professional status successfully', async () => {
      const updatedProfessional = createMockProfessional({
        status: ProfessionalStatus.VERIFIED,
      });
      mockProfessionalService.updateStatus.mockResolvedValue(
        updatedProfessional,
      );

      const result = await service.updateProfessionalStatus(
        'prof-123',
        { status: ProfessionalStatus.VERIFIED },
        adminUser,
      );

      expect(result.status).toBe(ProfessionalStatus.VERIFIED);
      expect(mockProfessionalService.updateStatus).toHaveBeenCalledWith(
        'prof-123',
        ProfessionalStatus.VERIFIED,
        adminUser,
      );
    });

    it('should throw NotFoundException when professional not found', async () => {
      mockProfessionalService.updateStatus.mockRejectedValue(
        new NotFoundException('Professional not found'),
      );

      await expect(
        service.updateProfessionalStatus(
          'non-existent',
          { status: ProfessionalStatus.VERIFIED },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject professional', async () => {
      const rejectedProfessional = createMockProfessional({
        status: ProfessionalStatus.REJECTED,
      });
      mockProfessionalService.updateStatus.mockResolvedValue(
        rejectedProfessional,
      );

      const result = await service.updateProfessionalStatus(
        'prof-123',
        { status: ProfessionalStatus.REJECTED },
        adminUser,
      );

      expect(result.status).toBe(ProfessionalStatus.REJECTED);
    });
  });
});
