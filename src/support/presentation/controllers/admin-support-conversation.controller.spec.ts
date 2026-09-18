import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BadRequestException } from '@nestjs/common';
import {
  SupportConversationStatus,
  SupportMessageDirection,
} from '@prisma/client';
import { AdminSupportConversationController } from './admin-support-conversation.controller';
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';
import { SupportConversationEntity } from '../../domain/entities/support-conversation.entity';
import { SupportMessageEntity } from '../../domain/entities/support-message.entity';

describe('AdminSupportConversationController', () => {
  let controller: AdminSupportConversationController;
  let mockService: any;

  const buildConversation = () =>
    new SupportConversationEntity(
      'conv-1',
      '+5492944123456',
      'user-1',
      null,
      SupportConversationStatus.OPEN,
      new Date(),
      null,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-01T00:00:00.000Z'),
      null,
      null,
    );

  beforeEach(() => {
    mockService = {
      listForAdmin: jest.fn(),
      getForAdmin: jest.fn(),
      replyForAdmin: jest.fn(),
      resolve: jest.fn(),
      reopen: jest.fn(),
    };
    controller = new AdminSupportConversationController(mockService);
  });

  it('is protected by JwtAuthGuard + AdminGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminSupportConversationController,
    );

    expect(guards).toEqual([JwtAuthGuard, AdminGuard]);
  });

  describe('list', () => {
    it('builds the standard pagination envelope, defaulting status to ALL', async () => {
      mockService.listForAdmin.mockResolvedValue({
        items: [buildConversation()],
        total: 1,
      });

      const result = await controller.list(undefined, '1', '20');

      expect(mockService.listForAdmin).toHaveBeenCalledWith({
        status: 'ALL',
        page: 1,
        limit: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({ id: 'conv-1', canReplyNow: true }),
      );
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('passes OPEN/RESOLVED through unchanged', async () => {
      mockService.listForAdmin.mockResolvedValue({ items: [], total: 0 });

      await controller.list('RESOLVED', '1', '20');

      expect(mockService.listForAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ status: SupportConversationStatus.RESOLVED }),
      );
    });

    it('rejects an invalid status filter', async () => {
      await expect(controller.list('BOGUS', '1', '20')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getOne', () => {
    it('returns the conversation and messages in the order the service gives them', async () => {
      const conversation = buildConversation();
      const message = new SupportMessageEntity(
        'msg-1',
        'conv-1',
        SupportMessageDirection.INBOUND,
        'hola',
        'SM1',
        null,
        new Date(),
      );
      mockService.getForAdmin.mockResolvedValue({
        conversation,
        messages: [message],
      });

      const result = await controller.getOne('conv-1');

      expect(result.conversation).toEqual(
        expect.objectContaining({ id: 'conv-1' }),
      );
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual(
        expect.objectContaining({ id: 'msg-1', body: 'hola' }),
      );
    });
  });

  describe('reply', () => {
    it('delegates to replyForAdmin with the current admin user id', async () => {
      const message = new SupportMessageEntity(
        'msg-2',
        'conv-1',
        SupportMessageDirection.OUTBOUND,
        'hola, en que te ayudamos',
        'SM2',
        'admin-1',
        new Date(),
      );
      mockService.replyForAdmin.mockResolvedValue(message);

      const result = await controller.reply(
        'conv-1',
        { message: 'hola, en que te ayudamos' },
        { id: 'admin-1' } as any,
      );

      expect(mockService.replyForAdmin).toHaveBeenCalledWith(
        'conv-1',
        'admin-1',
        'hola, en que te ayudamos',
      );
      expect(result).toEqual(
        expect.objectContaining({ id: 'msg-2', sentByUserId: 'admin-1' }),
      );
    });
  });

  describe('resolve / reopen', () => {
    it('resolve delegates with the current admin user id', async () => {
      await controller.resolve('conv-1', { id: 'admin-1' } as any);

      expect(mockService.resolve).toHaveBeenCalledWith('conv-1', 'admin-1');
    });

    it('reopen delegates with just the id', async () => {
      await controller.reopen('conv-1');

      expect(mockService.reopen).toHaveBeenCalledWith('conv-1');
    });
  });
});
