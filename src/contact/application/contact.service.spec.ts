import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CONTACT_REPOSITORY } from '../domain/repositories/contact.repository';
import { UserService } from '../../identity/application/services/user.service';
import { createMockUser } from '../../__mocks__/test-utils';
import { ContactEntity } from '../domain/entities/contact.entity';

const createMockContact = (overrides?: Partial<ContactEntity>): ContactEntity => {
  return new ContactEntity(
    overrides?.id || 'contact-123',
    overrides?.fromUserId || 'user-123',
    overrides?.toUserId || 'user-456',
    overrides?.contactType || 'whatsapp',
    overrides?.message || 'Hello, I need help',
    overrides?.createdAt || new Date(),
  );
};

describe('ContactService', () => {
  let service: ContactService;
  let mockContactRepository: any;
  let mockUserService: any;

  beforeEach(async () => {
    mockContactRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
    };

    mockUserService = {
      findById: jest.fn(),
      findByIdOrFail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: CONTACT_REPOSITORY, useValue: mockContactRepository },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      toUserId: 'user-456',
      contactType: 'whatsapp',
      message: 'Hello, I need help',
    };

    it('should create contact successfully', async () => {
      const fromUser = createMockUser({ id: 'user-123' });
      const toUser = createMockUser({ id: 'user-456' });
      const contact = createMockContact();

      mockUserService.findByIdOrFail
        .mockResolvedValueOnce(fromUser)
        .mockResolvedValueOnce(toUser);
      mockContactRepository.create.mockResolvedValue(contact);

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(contact);
      expect(mockContactRepository.create).toHaveBeenCalledWith({
        fromUserId: 'user-123',
        toUserId: 'user-456',
        contactType: 'whatsapp',
        message: 'Hello, I need help',
      });
    });

    it('should throw NotFoundException if from user not found', async () => {
      mockUserService.findByIdOrFail.mockRejectedValue(new NotFoundException('User not found'));

      await expect(service.create('non-existent', createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if to user not found', async () => {
      const fromUser = createMockUser({ id: 'user-123' });

      mockUserService.findByIdOrFail
        .mockResolvedValueOnce(fromUser)
        .mockRejectedValueOnce(new NotFoundException('User not found'));

      await expect(service.create('user-123', createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when trying to contact yourself', async () => {
      const user = createMockUser({ id: 'user-123' });

      mockUserService.findByIdOrFail.mockResolvedValue(user);

      const selfContactDto = { ...createDto, toUserId: 'user-123' };

      await expect(service.create('user-123', selfContactDto)).rejects.toThrow(BadRequestException);
    });

    it('should use default contact type if not provided', async () => {
      const fromUser = createMockUser({ id: 'user-123' });
      const toUser = createMockUser({ id: 'user-456' });
      const contact = createMockContact({ contactType: 'whatsapp' });

      mockUserService.findByIdOrFail
        .mockResolvedValueOnce(fromUser)
        .mockResolvedValueOnce(toUser);
      mockContactRepository.create.mockResolvedValue(contact);

      const dtoWithoutType = { toUserId: 'user-456' };

      await service.create('user-123', dtoWithoutType as any);

      expect(mockContactRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactType: 'whatsapp' }),
      );
    });

    it('should allow null message', async () => {
      const fromUser = createMockUser({ id: 'user-123' });
      const toUser = createMockUser({ id: 'user-456' });
      const contact = createMockContact({ message: null });

      mockUserService.findByIdOrFail
        .mockResolvedValueOnce(fromUser)
        .mockResolvedValueOnce(toUser);
      mockContactRepository.create.mockResolvedValue(contact);

      const dtoWithoutMessage = { toUserId: 'user-456', contactType: 'email' };

      await service.create('user-123', dtoWithoutMessage as any);

      expect(mockContactRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ message: null }),
      );
    });

    it('should support different contact types', async () => {
      const fromUser = createMockUser({ id: 'user-123' });
      const toUser = createMockUser({ id: 'user-456' });
      const contact = createMockContact({ contactType: 'email' });

      mockUserService.findByIdOrFail
        .mockResolvedValueOnce(fromUser)
        .mockResolvedValueOnce(toUser);
      mockContactRepository.create.mockResolvedValue(contact);

      const emailDto = { toUserId: 'user-456', contactType: 'email', message: 'Email me' };

      await service.create('user-123', emailDto);

      expect(mockContactRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactType: 'email' }),
      );
    });
  });

  describe('findByUserId', () => {
    it('should return contacts for user', async () => {
      const contacts = [
        createMockContact({ id: 'contact-1' }),
        createMockContact({ id: 'contact-2', toUserId: 'user-123', fromUserId: 'user-789' }),
      ];

      mockContactRepository.findByUserId.mockResolvedValue(contacts);

      const result = await service.findByUserId('user-123');

      expect(result).toHaveLength(2);
      expect(mockContactRepository.findByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should return empty array when no contacts', async () => {
      mockContactRepository.findByUserId.mockResolvedValue([]);

      const result = await service.findByUserId('user-123');

      expect(result).toHaveLength(0);
    });
  });
});
