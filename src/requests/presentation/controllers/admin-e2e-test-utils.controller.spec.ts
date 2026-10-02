import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminE2eTestUtilsController } from './admin-e2e-test-utils.controller';
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';

describe('AdminE2eTestUtilsController', () => {
  let controller: AdminE2eTestUtilsController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      deleteRequestsByTitlePrefix: jest.fn(),
    };
    controller = new AdminE2eTestUtilsController(mockService);
  });

  it('is protected by JwtAuthGuard + AdminGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminE2eTestUtilsController,
    );

    expect(guards).toEqual([JwtAuthGuard, AdminGuard]);
  });

  describe('deleteE2eData', () => {
    it('returns 404 (propagates NotFoundException) when the service reports E2E test utils are disabled', async () => {
      mockService.deleteRequestsByTitlePrefix.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        controller.deleteE2eData({ titlePrefix: '[E2E]' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('delegates to the service and wraps the result as { deletedCount }', async () => {
      mockService.deleteRequestsByTitlePrefix.mockResolvedValue(5);

      const result = await controller.deleteE2eData({ titlePrefix: '[E2E]' });

      expect(mockService.deleteRequestsByTitlePrefix).toHaveBeenCalledWith(
        '[E2E]',
      );
      expect(result).toEqual({ deletedCount: 5 });
    });
  });
});
