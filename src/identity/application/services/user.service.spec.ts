import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { createMockUser } from '../../../__mocks__/test-utils';

describe('UserService', () => {
  describe('setWhatsAppOptedOut', () => {
    let service: UserService;
    let mockUserRepository: any;
    let mockUserQueryRepository: any;

    beforeEach(() => {
      mockUserRepository = {
        findById: jest.fn(),
        save: jest.fn((u) => Promise.resolve(u)),
      };
      mockUserQueryRepository = {};
      service = new UserService(mockUserRepository, mockUserQueryRepository);
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
  });
});
