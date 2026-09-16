import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminWhatsAppDevController } from './admin-whatsapp-dev.controller';
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';

describe('AdminWhatsAppDevController', () => {
  let controller: AdminWhatsAppDevController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      simulateReply: jest.fn(),
      triggerFollowUp: jest.fn(),
    };
    controller = new AdminWhatsAppDevController(mockService);
  });

  it('is protected by JwtAuthGuard + AdminGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminWhatsAppDevController,
    );

    expect(guards).toEqual([JwtAuthGuard, AdminGuard]);
  });

  describe('simulateReply', () => {
    it('returns 404 (propagates NotFoundException) when the service reports dev mode is off', async () => {
      mockService.simulateReply.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        controller.simulateReply('request-1', { body: 'hola' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('delegates to the service and maps the result through the response DTO', async () => {
      mockService.simulateReply.mockResolvedValue(null);

      const result = await controller.simulateReply('request-1', {
        body: 'hola',
      } as any);

      expect(mockService.simulateReply).toHaveBeenCalledWith(
        'request-1',
        'hola',
      );
      expect(result).toBeNull();
    });
  });

  describe('triggerFollowUp', () => {
    it('returns 404 (propagates NotFoundException) when the service reports dev mode is off', async () => {
      mockService.triggerFollowUp.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        controller.triggerFollowUp('request-1', {
          ruleName: 'ACCEPTED_3_DAYS',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('delegates to the service', async () => {
      mockService.triggerFollowUp.mockResolvedValue({
        interactionId: 'interaction-1',
      });

      const result = await controller.triggerFollowUp('request-1', {
        ruleName: 'ACCEPTED_3_DAYS',
      } as any);

      expect(mockService.triggerFollowUp).toHaveBeenCalledWith(
        'request-1',
        'ACCEPTED_3_DAYS',
      );
      expect(result).toEqual({ interactionId: 'interaction-1' });
    });
  });
});
