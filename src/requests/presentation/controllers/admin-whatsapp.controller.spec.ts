import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminWhatsAppController } from './admin-whatsapp.controller';
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';

describe('AdminWhatsAppController', () => {
  let controller: AdminWhatsAppController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      getConfig: jest.fn(),
      listConversations: jest.fn(),
      getThread: jest.fn(),
    };
    controller = new AdminWhatsAppController(mockService);
  });

  it('is protected by JwtAuthGuard + AdminGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminWhatsAppController,
    );

    expect(guards).toEqual([JwtAuthGuard, AdminGuard]);
  });

  describe('getConfig', () => {
    it('delegates to the service', async () => {
      mockService.getConfig.mockReturnValue({ devMode: false });

      const result = await controller.getConfig();

      expect(result).toEqual({ devMode: false });
    });
  });

  describe('listConversations', () => {
    it('builds the standard pagination envelope from the service result', async () => {
      mockService.listConversations.mockResolvedValue({
        items: [{ requestId: 'r1' }],
        total: 25,
      });

      const result = await controller.listConversations('2', '10', 'foo');

      expect(mockService.listConversations).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: 'foo',
      });
      expect(result).toEqual({
        data: [{ requestId: 'r1' }],
        meta: { total: 25, page: 2, limit: 10, totalPages: 3 },
      });
    });

    it('defaults to page=1, limit=20 when not provided', async () => {
      mockService.listConversations.mockResolvedValue({ items: [], total: 0 });

      await controller.listConversations(undefined, undefined, undefined);

      expect(mockService.listConversations).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: undefined,
      });
    });
  });

  describe('getThread', () => {
    it('maps interactions through WhatsAppInteractionResponseDto', async () => {
      mockService.getThread.mockResolvedValue([]);

      const result = await controller.getThread('request-1');

      expect(mockService.getThread).toHaveBeenCalledWith('request-1');
      expect(result).toEqual([]);
    });
  });
});
