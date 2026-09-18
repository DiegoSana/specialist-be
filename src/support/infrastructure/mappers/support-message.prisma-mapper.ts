import { SupportMessageDirection } from '@prisma/client';
import { SupportMessageEntity } from '../../domain/entities/support-message.entity';

export class PrismaSupportMessageMapper {
  static toDomain(record: any): SupportMessageEntity {
    return new SupportMessageEntity(
      record.id,
      record.conversationId,
      record.direction as SupportMessageDirection,
      record.body,
      record.twilioMessageSid,
      record.sentByUserId,
      record.createdAt,
    );
  }

  static toPersistence(message: SupportMessageEntity): Record<string, unknown> {
    return {
      id: message.id,
      conversationId: message.conversationId,
      direction: message.direction,
      body: message.body,
      twilioMessageSid: message.twilioMessageSid,
      sentByUserId: message.sentByUserId,
    };
  }
}
