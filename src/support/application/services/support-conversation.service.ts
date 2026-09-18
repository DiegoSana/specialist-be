import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupportConversationStatus } from '@prisma/client';
import {
  SUPPORT_CONVERSATION_REPOSITORY,
  SupportConversationRepository,
} from '../../domain/repositories/support-conversation.repository';
import {
  SUPPORT_MESSAGE_REPOSITORY,
  SupportMessageRepository,
} from '../../domain/repositories/support-message.repository';
import { SupportConversationEntity } from '../../domain/entities/support-conversation.entity';
import { SupportMessageEntity } from '../../domain/entities/support-message.entity';
import { SupportConversationAttentionFlaggedEvent } from '../../domain/events/support-conversation-attention-flagged.event';
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import {
  WHATSAPP_MESSAGING_PORT,
  WhatsAppMessagingPort,
} from '../../../shared/domain/ports/whatsapp-messaging.port';
import { UserService } from '../../../identity/application/services/user.service';

export type SupportConversationListStatusFilter =
  | SupportConversationStatus
  | 'ALL';

/**
 * Owns the support conversation lifecycle: recording inbound WhatsApp messages
 * (whether or not they're tied to a Request), and the admin-facing read/reply/
 * resolve/reopen operations. No `canXxxBy` here - this context has no
 * authenticated end-user surface, only AdminGuard-protected admin routes.
 */
@Injectable()
export class SupportConversationService {
  private readonly logger = new Logger(SupportConversationService.name);

  constructor(
    @Inject(SUPPORT_CONVERSATION_REPOSITORY)
    private readonly conversationRepository: SupportConversationRepository,
    @Inject(SUPPORT_MESSAGE_REPOSITORY)
    private readonly messageRepository: SupportMessageRepository,
    @Inject(WHATSAPP_MESSAGING_PORT)
    private readonly whatsAppMessaging: WhatsAppMessagingPort,
    private readonly userService: UserService,
    @Inject(EVENT_BUS)
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Entry point for an inbound WhatsApp message that didn't match any pending
   * RequestInteraction follow-up (see RequestInteractionService.processInboundMessage).
   * Idempotent on `twilioMessageSid`. Publishes SupportConversationAttentionFlaggedEvent
   * only when the conversation is brand new or was RESOLVED (never on message 2..N of
   * an already-OPEN conversation) - see SupportConversationEntity.recordInboundMessage.
   */
  async receiveInboundMessage(params: {
    phoneNumber: string;
    body: string;
    twilioMessageSid: string;
  }): Promise<void> {
    const alreadyRecorded = await this.messageRepository.findByTwilioMessageSid(
      params.twilioMessageSid,
    );
    if (alreadyRecorded) {
      this.logger.debug(
        `Inbound support message already recorded: MessageSid=${params.twilioMessageSid}`,
      );
      return;
    }

    const now = new Date();
    let conversation = await this.conversationRepository.findByPhoneNumber(
      params.phoneNumber,
    );
    let notifyNeeded: boolean;

    if (!conversation) {
      const userId = await this.resolveUserIdByPhone(params.phoneNumber);
      conversation = SupportConversationEntity.createFromInboundMessage({
        id: randomUUID(),
        phoneNumber: params.phoneNumber,
        userId,
        relatedRequestId: null,
        now,
      });
      notifyNeeded = true;
    } else {
      const { conversation: updated, reopened } =
        conversation.recordInboundMessage(now);
      conversation = updated;
      notifyNeeded = reopened;
    }

    conversation = await this.conversationRepository.save(conversation);

    await this.messageRepository.add(
      SupportMessageEntity.createInbound({
        id: randomUUID(),
        conversationId: conversation.id,
        body: params.body,
        twilioMessageSid: params.twilioMessageSid,
        now,
      }),
    );

    this.logger.log(
      `Recorded inbound support message for conversation ${conversation.id} (phone=${params.phoneNumber}, notify=${notifyNeeded})`,
    );

    if (notifyNeeded) {
      await this.eventBus.publish(
        new SupportConversationAttentionFlaggedEvent({
          conversationId: conversation.id,
          phoneNumber: conversation.phoneNumber,
          userId: conversation.userId,
        }),
      );
    }
  }

  /**
   * Best-effort phone -> user resolution. Never blocks conversation creation:
   * on any lookup failure, the conversation is simply created with userId=null.
   */
  private async resolveUserIdByPhone(
    phoneNumber: string,
  ): Promise<string | null> {
    try {
      const user = await this.userService.findByPhone(phoneNumber);
      return user?.id ?? null;
    } catch (error) {
      this.logger.warn(
        `Failed to resolve user by phone for support conversation (phone=${phoneNumber}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async listForAdmin(params: {
    status?: SupportConversationListStatusFilter;
    page: number;
    limit: number;
  }): Promise<{ items: SupportConversationEntity[]; total: number }> {
    const status =
      !params.status || params.status === 'ALL' ? undefined : params.status;

    return this.conversationRepository.findManyForAdmin({
      status,
      page: params.page,
      limit: params.limit,
    });
  }

  async getForAdmin(id: string): Promise<{
    conversation: SupportConversationEntity;
    messages: SupportMessageEntity[];
  }> {
    const conversation = await this.conversationRepository.findById(id);
    if (!conversation) {
      throw new NotFoundException(
        `SupportConversation with id ${id} not found`,
      );
    }

    const messages = await this.messageRepository.findByConversationId(id);

    return { conversation, messages };
  }

  /**
   * Send an admin reply. Outside the WhatsApp 24h reply window, throws before
   * attempting to send (Twilio/Meta would reject it anyway) with a shape the
   * frontend can render directly. If the send itself fails, nothing is
   * persisted - accepted simplification for v1 (see src/support/CLAUDE.md).
   */
  async replyForAdmin(
    id: string,
    adminUserId: string,
    message: string,
  ): Promise<SupportMessageEntity> {
    const conversation = await this.conversationRepository.findById(id);
    if (!conversation) {
      throw new NotFoundException(
        `SupportConversation with id ${id} not found`,
      );
    }

    const now = new Date();
    if (!conversation.isWithinReplyWindow(now)) {
      throw new BadRequestException({
        code: 'WHATSAPP_WINDOW_EXPIRED',
        message:
          'No se puede responder: pasaron más de 24hs desde el último mensaje del usuario.',
        lastInboundAt: conversation.lastInboundAt,
      });
    }

    const { messageId } = await this.whatsAppMessaging.sendMessage(
      conversation.phoneNumber,
      message,
    );

    const outboundMessage = await this.messageRepository.add(
      SupportMessageEntity.createOutbound({
        id: randomUUID(),
        conversationId: conversation.id,
        body: message,
        sentByUserId: adminUserId,
        twilioMessageSid: messageId,
        now,
      }),
    );

    await this.conversationRepository.save(
      conversation.recordOutboundMessage(now),
    );

    return outboundMessage;
  }

  /** Idempotent. */
  async resolve(id: string, adminUserId: string): Promise<void> {
    const conversation = await this.conversationRepository.findById(id);
    if (!conversation) {
      throw new NotFoundException(
        `SupportConversation with id ${id} not found`,
      );
    }

    await this.conversationRepository.save(
      conversation.resolve(adminUserId, new Date()),
    );
  }

  /** Idempotent. */
  async reopen(id: string): Promise<void> {
    const conversation = await this.conversationRepository.findById(id);
    if (!conversation) {
      throw new NotFoundException(
        `SupportConversation with id ${id} not found`,
      );
    }

    await this.conversationRepository.save(conversation.reopen(new Date()));
  }
}
