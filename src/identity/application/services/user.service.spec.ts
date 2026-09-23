import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { createMockUser } from '../../../__mocks__/test-utils';
import { UserWhatsAppOptedOutEvent } from '../../domain/events/user-whatsapp-opted-out.event';
import { UserWhatsAppReactivatedEvent } from '../../domain/events/user-whatsapp-reactivated.event';

describe('UserService', () => {
  describe('setWhatsAppOptedOut', () => {
    let service: UserService;
    let mockUserRepository: any;
    let mockUserQueryRepository: any;
    let mockEventBus: any;

    beforeEach(() => {
      mockUserRepository = {
        findById: jest.fn(),
        save: jest.fn((u) => Promise.resolve(u)),
      };
      mockUserQueryRepository = {};
      mockEventBus = { publish: jest.fn() };
      service = new UserService(
        mockUserRepository,
        mockUserQueryRepository,
        mockEventBus,
      );
    });

    it('sets whatsappOptedOut and stamps whatsappOptedOutAt via the entity mutator', async () => {
      const user = createMockUser({ whatsappOptedOut: false });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.setWhatsAppOptedOut('user-123', true);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          whatsappOptedOut: true,
          whatsappOptedOutAt: expect.any(Date),
        }),
      );
    });

    it('clears whatsappOptedOutAt when opting back in', async () => {
      const user = createMockUser({
        whatsappOptedOut: true,
        whatsappOptedOutAt: new Date(),
      });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.setWhatsAppOptedOut('user-123', false);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          whatsappOptedOut: false,
          whatsappOptedOutAt: null,
        }),
      );
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.setWhatsAppOptedOut('missing-user', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('publishes UserWhatsAppOptedOutEvent on the false -> true transition', async () => {
      const user = createMockUser({ id: 'user-123', whatsappOptedOut: false });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.setWhatsAppOptedOut('user-123', true);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: UserWhatsAppOptedOutEvent.EVENT_NAME,
          payload: { userId: 'user-123' },
        }),
      );
    });

    it('does not publish when the user was already opted out', async () => {
      const user = createMockUser({ id: 'user-123', whatsappOptedOut: true });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.setWhatsAppOptedOut('user-123', true);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('publishes UserWhatsAppReactivatedEvent on the true -> false transition', async () => {
      const user = createMockUser({ id: 'user-123', whatsappOptedOut: true });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.setWhatsAppOptedOut('user-123', false);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: UserWhatsAppReactivatedEvent.EVENT_NAME,
          payload: { userId: 'user-123' },
        }),
      );
    });

    it('does not publish when the user was already opted in', async () => {
      const user = createMockUser({ id: 'user-123', whatsappOptedOut: false });
      mockUserRepository.findById.mockResolvedValue(user);

      await service.setWhatsAppOptedOut('user-123', false);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('updateWhatsAppOptOutForUser', () => {
    let service: UserService;
    let mockUserRepository: any;
    let mockUserQueryRepository: any;
    let mockEventBus: any;

    beforeEach(() => {
      mockUserRepository = {
        findById: jest.fn(),
        save: jest.fn((u) => Promise.resolve(u)),
      };
      mockUserQueryRepository = {};
      mockEventBus = { publish: jest.fn() };
      service = new UserService(
        mockUserRepository,
        mockUserQueryRepository,
        mockEventBus,
      );
    });

    const adminUser = createMockUser({ id: 'admin-1', isAdmin: true });

    it('throws ForbiddenException when the acting user is not an admin', async () => {
      const nonAdmin = createMockUser({ id: 'user-1', isAdmin: false });

      await expect(
        service.updateWhatsAppOptOutForUser('target-1', nonAdmin, true),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateWhatsAppOptOutForUser('missing', adminUser, true),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets the flag and publishes the event when transitioning false -> true', async () => {
      const target = createMockUser({
        id: 'target-1',
        whatsappOptedOut: false,
      });
      mockUserRepository.findById.mockResolvedValue(target);

      const result = await service.updateWhatsAppOptOutForUser(
        'target-1',
        adminUser,
        true,
      );

      expect(result.whatsappOptedOut).toBe(true);
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ whatsappOptedOut: true }),
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: UserWhatsAppOptedOutEvent.EVENT_NAME,
          payload: { userId: 'target-1' },
        }),
      );
    });

    it('clears the flag and publishes the reactivation event when transitioning true -> false', async () => {
      const target = createMockUser({
        id: 'target-1',
        whatsappOptedOut: true,
      });
      mockUserRepository.findById.mockResolvedValue(target);

      const result = await service.updateWhatsAppOptOutForUser(
        'target-1',
        adminUser,
        false,
      );

      expect(result.whatsappOptedOut).toBe(false);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: UserWhatsAppReactivatedEvent.EVENT_NAME,
          payload: { userId: 'target-1' },
        }),
      );
    });

    it('is a no-op and does not touch the repository save/event bus when the value is unchanged', async () => {
      const target = createMockUser({
        id: 'target-1',
        whatsappOptedOut: true,
      });
      mockUserRepository.findById.mockResolvedValue(target);

      const result = await service.updateWhatsAppOptOutForUser(
        'target-1',
        adminUser,
        true,
      );

      expect(result).toBe(target);
      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('reactivateWhatsAppForUser', () => {
    let service: UserService;
    let mockUserRepository: any;
    let mockUserQueryRepository: any;
    let mockEventBus: any;

    beforeEach(() => {
      mockUserRepository = {
        findById: jest.fn(),
        save: jest.fn((u) => Promise.resolve(u)),
      };
      mockUserQueryRepository = {};
      mockEventBus = { publish: jest.fn() };
      service = new UserService(
        mockUserRepository,
        mockUserQueryRepository,
        mockEventBus,
      );
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.reactivateWhatsAppForUser('missing-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('is a no-op and does not touch the repository save/event bus when the user is not opted out', async () => {
      const user = createMockUser({ id: 'user-1', whatsappOptedOut: false });
      mockUserRepository.findById.mockResolvedValue(user);

      const result = await service.reactivateWhatsAppForUser('user-1');

      expect(result).toBe(user);
      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('clears the flag and publishes UserWhatsAppReactivatedEvent when the user is opted out', async () => {
      const user = createMockUser({
        id: 'user-1',
        whatsappOptedOut: true,
        whatsappOptedOutAt: new Date(),
      });
      mockUserRepository.findById.mockResolvedValue(user);

      const result = await service.reactivateWhatsAppForUser('user-1');

      expect(result.whatsappOptedOut).toBe(false);
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          whatsappOptedOut: false,
          whatsappOptedOutAt: null,
        }),
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: UserWhatsAppReactivatedEvent.EVENT_NAME,
          payload: { userId: 'user-1' },
        }),
      );
    });
  });
});
