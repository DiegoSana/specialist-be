import { SupportConversationStatus } from '@prisma/client';
import { SupportConversationEntity } from '../../domain/entities/support-conversation.entity';

export class PrismaSupportConversationMapper {
  static toDomain(record: any): SupportConversationEntity {
    return new SupportConversationEntity(
      record.id,
      record.phoneNumber,
      record.userId,
      record.relatedRequestId,
      record.status as SupportConversationStatus,
      record.lastInboundAt,
      record.lastOutboundAt,
      record.createdAt,
      record.updatedAt,
      record.resolvedAt,
      record.resolvedByUserId,
    );
  }

  static toPersistence(
    conversation: SupportConversationEntity,
  ): Record<string, unknown> {
    return {
      id: conversation.id,
      phoneNumber: conversation.phoneNumber,
      userId: conversation.userId,
      relatedRequestId: conversation.relatedRequestId,
      status: conversation.status,
      lastInboundAt: conversation.lastInboundAt,
      lastOutboundAt: conversation.lastOutboundAt,
      resolvedAt: conversation.resolvedAt,
      resolvedByUserId: conversation.resolvedByUserId,
    };
  }
}
