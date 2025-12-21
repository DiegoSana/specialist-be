import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UserService } from '../../identity/application/services/user.service';
import { ProfessionalService } from '../../profiles/application/services/professional.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { createMockUser, createMockProfessional } from '../../__mocks__/test-utils';
import { UserStatus, ProfessionalStatus } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let mockUserService: any;
  let mockProfessionalService: any;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockUserService = {
      findById: jest.fn(),
      findByIdOrFail: jest.fn(),
      update: jest.fn(),
    };

    mockProfessionalService = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockPrismaService = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      professional: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UserService, useValue: mockUserService },
        { provide: ProfessionalService, useValue: mockProfessionalService },
        { provide: PrismaService, useValue: mockPrismaService },
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
        { id: 'user-1', email: 'user1@test.com', firstName: 'User', lastName: 'One', status: 'ACTIVE', createdAt: new Date(), client: null, professional: null },
        { id: 'user-2', email: 'user2@test.com', firstName: 'User', lastName: 'Two', status: 'ACTIVE', createdAt: new Date(), client: { id: 'client-1' }, professional: null },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(users);
      mockPrismaService.user.count.mockResolvedValue(15);

      const result = await service.getAllUsers(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(15);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should handle empty results', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      const result = await service.getAllUsers(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should apply pagination correctly', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(25);

      await service.getAllUsers(3, 5);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });

    it('should use default pagination values', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.getAllUsers();

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const user = createMockUser();
      mockUserService.findByIdOrFail.mockResolvedValue(user);

      const result = await service.getUserById('user-123');

      expect(result).toEqual(user);
      expect(mockUserService.findByIdOrFail).toHaveBeenCalledWith('user-123');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.findByIdOrFail.mockRejectedValue(new NotFoundException('User not found'));

      await expect(service.getUserById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status successfully', async () => {
      const updatedUser = createMockUser({ status: UserStatus.SUSPENDED });
      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await service.updateUserStatus('user-123', { status: UserStatus.SUSPENDED });

      expect(result.status).toBe(UserStatus.SUSPENDED);
      expect(mockUserService.update).toHaveBeenCalledWith('user-123', { status: UserStatus.SUSPENDED });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.update.mockRejectedValue(new NotFoundException('User not found'));

      await expect(
        service.updateUserStatus('non-existent', { status: UserStatus.SUSPENDED }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllProfessionals', () => {
    it('should return paginated professionals', async () => {
      const professionals = [
        {
          id: 'prof-1',
          userId: 'user-1',
          user: { id: 'user-1', email: 'pro1@test.com', firstName: 'Pro', lastName: 'One' },
          trades: [{ trade: { id: 'trade-1', name: 'Electricista' } }],
          createdAt: new Date(),
        },
      ];

      mockPrismaService.professional.findMany.mockResolvedValue(professionals);
      mockPrismaService.professional.count.mockResolvedValue(5);

      const result = await service.getAllProfessionals(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(5);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should handle empty results', async () => {
      mockPrismaService.professional.findMany.mockResolvedValue([]);
      mockPrismaService.professional.count.mockResolvedValue(0);

      const result = await service.getAllProfessionals(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should apply pagination correctly', async () => {
      mockPrismaService.professional.findMany.mockResolvedValue([]);
      mockPrismaService.professional.count.mockResolvedValue(30);

      await service.getAllProfessionals(2, 15);

      expect(mockPrismaService.professional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 15,
          take: 15,
        }),
      );
    });
  });

  describe('updateProfessionalStatus', () => {
    it('should update professional status successfully', async () => {
      const updatedProfessional = createMockProfessional({ status: ProfessionalStatus.VERIFIED });
      mockProfessionalService.updateStatus.mockResolvedValue(updatedProfessional);

      const result = await service.updateProfessionalStatus('prof-123', {
        status: ProfessionalStatus.VERIFIED,
      });

      expect(result.status).toBe(ProfessionalStatus.VERIFIED);
      expect(mockProfessionalService.updateStatus).toHaveBeenCalledWith('prof-123', ProfessionalStatus.VERIFIED);
    });

    it('should throw NotFoundException when professional not found', async () => {
      mockProfessionalService.updateStatus.mockRejectedValue(new NotFoundException('Professional not found'));

      await expect(
        service.updateProfessionalStatus('non-existent', { status: ProfessionalStatus.VERIFIED }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject professional', async () => {
      const rejectedProfessional = createMockProfessional({ status: ProfessionalStatus.REJECTED });
      mockProfessionalService.updateStatus.mockResolvedValue(rejectedProfessional);

      const result = await service.updateProfessionalStatus('prof-123', {
        status: ProfessionalStatus.REJECTED,
      });

      expect(result.status).toBe(ProfessionalStatus.REJECTED);
    });
  });
});
