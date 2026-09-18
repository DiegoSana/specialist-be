import { NotFoundException } from '@nestjs/common';
import { SupportConversationStatus } from '@prisma/client';
import { SupportConversationService } from './support-conversation.service';
import { SupportConversationEntity } from '../../domain/entities/support-conversation.entity';
import { SupportConversationAttentionFlaggedEvent } from '../../domain/events/support-conversation-attention-flagged.event';

describe('SupportConversationService', () => {
  let service: SupportConversationService;
  let mockConversationRepository: any;
  let mockMessageRepository: any;
  let mockWhatsAppMessaging: any;
  let mockUserService: any;
  let mockEventBus: any;

  const buildConversation = (
    overrides: Partial<{
      id: string;
      phoneNumber: string;
      userId: string | null;
      status: SupportConversationStatus;
      lastInboundAt: Date | null;
      lastOutboundAt: Date | null;
      resolvedAt: Date | null;
      resolvedByUserId: string | null;
    }> = {},
  ): SupportConversationEntity =>
    new SupportConversationEntity(
      overrides.id ?? 'conv-1',
      overrides.phoneNumber ?? '+5492944123456',
      overrides.userId ?? null,
      null,
      overrides.status ?? SupportConversationStatus.OPEN,
      overrides.lastInboundAt ?? new Date(),
      overrides.lastOutboundAt ?? null,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-01T00:00:00.000Z'),
      overrides.resolvedAt ?? null,
      overrides.resolvedByUserId ?? null,
    );

  beforeEach(() => {
    mockConversationRepository = {
      findById: jest.fn(),
      findByPhoneNumber: jest.fn(),
      findManyForAdmin: jest.fn(),
      save: jest.fn((c) => Promise.resolve(c)),
    };
    mockMessageRepository = {
      add: jest.fn((m) => Promise.resolve(m)),
      findByConversationId: jest.fn().mockResolvedValue([]),
      findByTwilioMessageSid: jest.fn(),
    };
    mockWhatsAppMessaging = { sendMessage: jest.fn() };
    mockUserService = { findByPhone: jest.fn() };
    mockEventBus = { publish: jest.fn() };

    service = new SupportConversationService(
      mockConversationRepository,
      mockMessageRepository,
      mockWhatsAppMessaging,
      mockUserService,
      mockEventBus,
    );
  });

  describe('hasOpenConversation', () => {
    it.each([
      [SupportConversationStatus.OPEN, true],
      [SupportConversationStatus.RESOLVED, false],
    ])(
      'returns correctly when the conversation is %s',
      async (status, expected) => {
        mockConversationRepository.findByPhoneNumber.mockResolvedValue(
          buildConversation({ status }),
        );

        await expect(
          service.hasOpenConversation('+5492944123456'),
        ).resolves.toBe(expected);
      },
    );

    it('returns false when there is no conversation for the phone', async () => {
      mockConversationRepository.findByPhoneNumber.mockResolvedValue(null);

      await expect(service.hasOpenConversation('+5492944123456')).resolves.toBe(
        false,
      );
    });
  });

  describe('receiveInboundMessage', () => {
    it('is idempotent: does nothing when the twilioMessageSid was already recorded', async () => {
      mockMessageRepository.findByTwilioMessageSid.mockResolvedValue({
        id: 'msg-1',
      });

      await service.receiveInboundMessage({
        phoneNumber: '+5492944123456',
        body: 'hola',
        twilioMessageSid: 'SM123',
      });

      expect(
        mockConversationRepository.findByPhoneNumber,
      ).not.toHaveBeenCalled();
      expect(mockConversationRepository.save).not.toHaveBeenCalled();
      expect(mockMessageRepository.add).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('creates a new OPEN conversation, resolves the user by phone, and publishes the attention event', async () => {
      mockMessageRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockConversationRepository.findByPhoneNumber.mockResolvedValue(null);
      mockUserService.findByPhone.mockResolvedValue({ id: 'user-1' });

      await service.receiveInboundMessage({
        phoneNumber: '+5492944123456',
        body: 'hola, necesito ayuda',
        twilioMessageSid: 'SM123',
      });

      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SupportConversationStatus.OPEN,
          userId: 'user-1',
        }),
      );
      expect(mockMessageRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'hola, necesito ayuda',
          twilioMessageSid: 'SM123',
        }),
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: SupportConversationAttentionFlaggedEvent.EVENT_NAME,
          payload: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('creates the conversation with userId=null when the phone cannot be resolved to a user', async () => {
      mockMessageRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockConversationRepository.findByPhoneNumber.mockResolvedValue(null);
      mockUserService.findByPhone.mockResolvedValue(null);

      await service.receiveInboundMessage({
        phoneNumber: '+5492944123456',
        body: 'hola',
        twilioMessageSid: 'SM123',
      });

      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null }),
      );
    });

    it('never blocks conversation creation when the phone->user lookup throws', async () => {
      mockMessageRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockConversationRepository.findByPhoneNumber.mockResolvedValue(null);
      mockUserService.findByPhone.mockRejectedValue(new Error('db down'));

      await service.receiveInboundMessage({
        phoneNumber: '+5492944123456',
        body: 'hola',
        twilioMessageSid: 'SM123',
      });

      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null }),
      );
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('does not publish the attention event for a 2nd inbound message on an already-OPEN conversation', async () => {
      mockMessageRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockConversationRepository.findByPhoneNumber.mockResolvedValue(
        buildConversation({ status: SupportConversationStatus.OPEN }),
      );

      await service.receiveInboundMessage({
        phoneNumber: '+5492944123456',
        body: 'otro mensaje',
        twilioMessageSid: 'SM456',
      });

      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SupportConversationStatus.OPEN }),
      );
    });

    it('stores relatedRequestId on a new conversation', async () => {
      mockMessageRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockConversationRepository.findByPhoneNumber.mockResolvedValue(null);
      mockUserService.findByPhone.mockResolvedValue(null);

      await service.receiveInboundMessage({
        phoneNumber: '+5492944123456',
        body: 'hola',
        twilioMessageSid: 'SM1',
        relatedRequestId: 'req-1',
      });

      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ relatedRequestId: 'req-1' }),
      );
    });

    it('updates relatedRequestId on an existing conversation, and keeps it when none is provided', async () => {
      mockMessageRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockConversationRepository.findByPhoneNumber.mockResolvedValue(
        buildConversation({ status: SupportConversationStatus.OPEN }),
      );

      await service.receiveInboundMessage({
        phoneNumber: '+5492944123456',
        body: 'otro',
        twilioMessageSid: 'SM2',
        relatedRequestId: 'req-2',
      });
      expect(mockConversationRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ relatedRequestId: 'req-2' }),
      );

      const withRequest = buildConversation().withRelatedRequestId('req-2');
      mockConversationRepository.findByPhoneNumber.mockResolvedValue(
        withRequest,
      );
      await service.receiveInboundMessage({
        phoneNumber: '+5492944123456',
        body: 'otro más',
        twilioMessageSid: 'SM3',
        relatedRequestId: null,
      });
      expect(mockConversationRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ relatedRequestId: 'req-2' }),
      );
    });

    it('publishes the attention event again when a RESOLVED conversation is reopened by a new inbound message', async () => {
      mockMessageRepository.findByTwilioMessageSid.mockResolvedValue(null);
      mockConversationRepository.findByPhoneNumber.mockResolvedValue(
        buildConversation({
          status: SupportConversationStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedByUserId: 'admin-1',
        }),
      );

      await service.receiveInboundMessage({
        phoneNumber: '+5492944123456',
        body: 'de nuevo necesito ayuda',
        twilioMessageSid: 'SM789',
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: SupportConversationAttentionFlaggedEvent.EVENT_NAME,
        }),
      );
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SupportConversationStatus.OPEN,
          resolvedAt: null,
          resolvedByUserId: null,
        }),
      );
    });
  });

  describe('replyForAdmin', () => {
    it('throws NotFoundException when the conversation does not exist', async () => {
      mockConversationRepository.findById.mockResolvedValue(null);

      await expect(
        service.replyForAdmin('missing', 'admin-1', 'hola'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws a WHATSAPP_WINDOW_EXPIRED BadRequestException outside the 24h reply window, without sending', async () => {
      const lastInboundAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      mockConversationRepository.findById.mockResolvedValue(
        buildConversation({ lastInboundAt }),
      );

      await expect(
        service.replyForAdmin('conv-1', 'admin-1', 'hola'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'WHATSAPP_WINDOW_EXPIRED' }),
      });
      expect(mockWhatsAppMessaging.sendMessage).not.toHaveBeenCalled();
    });

    it('sends, persists the outbound message with sentByUserId, and updates lastOutboundAt within the window', async () => {
      const lastInboundAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
      mockConversationRepository.findById.mockResolvedValue(
        buildConversation({ lastInboundAt }),
      );
      mockWhatsAppMessaging.sendMessage.mockResolvedValue({
        messageId: 'SM999',
      });

      const result = await service.replyForAdmin(
        'conv-1',
        'admin-1',
        'te ayudamos ya',
      );

      expect(mockWhatsAppMessaging.sendMessage).toHaveBeenCalledWith(
        '+5492944123456',
        'te ayudamos ya',
      );
      expect(mockMessageRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'te ayudamos ya',
          sentByUserId: 'admin-1',
          twilioMessageSid: 'SM999',
        }),
      );
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastOutboundAt: expect.any(Date) }),
      );
      expect(result).toEqual(
        expect.objectContaining({ body: 'te ayudamos ya' }),
      );
    });

    it('does not persist anything when the send itself fails', async () => {
      const lastInboundAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
      mockConversationRepository.findById.mockResolvedValue(
        buildConversation({ lastInboundAt }),
      );
      mockWhatsAppMessaging.sendMessage.mockRejectedValue(
        new Error('Twilio down'),
      );

      await expect(
        service.replyForAdmin('conv-1', 'admin-1', 'hola'),
      ).rejects.toThrow('Twilio down');
      expect(mockMessageRepository.add).not.toHaveBeenCalled();
      expect(mockConversationRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('resolve / reopen', () => {
    it('resolve() throws NotFoundException when missing', async () => {
      mockConversationRepository.findById.mockResolvedValue(null);
      await expect(service.resolve('missing', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('resolve() saves a RESOLVED conversation stamped with the admin user', async () => {
      mockConversationRepository.findById.mockResolvedValue(
        buildConversation(),
      );

      await service.resolve('conv-1', 'admin-1');

      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SupportConversationStatus.RESOLVED,
          resolvedByUserId: 'admin-1',
        }),
      );
    });

    it('reopen() throws NotFoundException when missing', async () => {
      mockConversationRepository.findById.mockResolvedValue(null);
      await expect(service.reopen('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('reopen() saves an OPEN conversation with resolution fields cleared', async () => {
      mockConversationRepository.findById.mockResolvedValue(
        buildConversation({
          status: SupportConversationStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedByUserId: 'admin-1',
        }),
      );

      await service.reopen('conv-1');

      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SupportConversationStatus.OPEN,
          resolvedAt: null,
          resolvedByUserId: null,
        }),
      );
    });
  });

  describe('listForAdmin / getForAdmin', () => {
    it('maps the ALL filter to an undefined status (no filtering)', async () => {
      mockConversationRepository.findManyForAdmin.mockResolvedValue({
        items: [],
        total: 0,
      });

      await service.listForAdmin({ status: 'ALL', page: 1, limit: 20 });

      expect(mockConversationRepository.findManyForAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
      );
    });

    it('getForAdmin throws NotFoundException when missing', async () => {
      mockConversationRepository.findById.mockResolvedValue(null);
      await expect(service.getForAdmin('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('getForAdmin returns the conversation and its chronological messages', async () => {
      const conversation = buildConversation();
      mockConversationRepository.findById.mockResolvedValue(conversation);
      mockMessageRepository.findByConversationId.mockResolvedValue([
        { id: 'msg-1' },
        { id: 'msg-2' },
      ]);

      const result = await service.getForAdmin('conv-1');

      expect(result.conversation).toBe(conversation);
      expect(result.messages).toHaveLength(2);
    });
  });
});
