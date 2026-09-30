import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminVerificationController } from './admin-verification.controller';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../shared/presentation/guards/admin.guard';

describe('AdminVerificationController', () => {
  let controller: AdminVerificationController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      getConfig: jest.fn(),
    };
    controller = new AdminVerificationController(mockService);
  });

  it('is protected by JwtAuthGuard + AdminGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminVerificationController,
    );

    expect(guards).toEqual([JwtAuthGuard, AdminGuard]);
  });

  describe('getConfig', () => {
    it('delegates to the service', async () => {
      mockService.getConfig.mockReturnValue({
        provider: 'local',
        devCode: '000000',
      });

      const result = await controller.getConfig();

      expect(result).toEqual({ provider: 'local', devCode: '000000' });
    });
  });
});
