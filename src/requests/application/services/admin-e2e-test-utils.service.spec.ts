import { NotFoundException } from '@nestjs/common';
import { AdminE2eTestUtilsService } from './admin-e2e-test-utils.service';

describe('AdminE2eTestUtilsService', () => {
  let service: AdminE2eTestUtilsService;
  let mockRequestRepository: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockRequestRepository = {
      deleteByTitlePrefix: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn(),
    };
    service = new AdminE2eTestUtilsService(
      mockRequestRepository,
      mockConfigService,
    );
  });

  describe('deleteRequestsByTitlePrefix', () => {
    it('throws NotFoundException without touching the repository when E2E_TEST_UTILS_ENABLED is not "true"', async () => {
      mockConfigService.get.mockReturnValue('false');

      await expect(
        service.deleteRequestsByTitlePrefix('[E2E]'),
      ).rejects.toThrow(NotFoundException);
      expect(mockRequestRepository.deleteByTitlePrefix).not.toHaveBeenCalled();
    });

    it('delegates to the repository and returns the deleted count when enabled', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, def?: string) =>
          (key === 'E2E_TEST_UTILS_ENABLED' ? 'true' : def) as any,
      );
      mockRequestRepository.deleteByTitlePrefix.mockResolvedValue(3);

      const result = await service.deleteRequestsByTitlePrefix('[E2E]');

      expect(mockRequestRepository.deleteByTitlePrefix).toHaveBeenCalledWith(
        '[E2E]',
      );
      expect(result).toBe(3);
    });
  });
});
