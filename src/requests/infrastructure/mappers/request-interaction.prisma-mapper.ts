import {
  InteractionType,
  InteractionStatus,
  InteractionDirection,
  ResponseIntent,
} from '@prisma/client';
import { RequestInteractionEntity } from '../../domain/entities/request-interaction.entity';

export class PrismaRequestInteractionMapper {
  static toDomain(interaction: any): RequestInteractionEntity {
    return new RequestInteractionEntity(
      interaction.id,
      interaction.requestId,
      interaction.interactionType as InteractionType,
      interaction.status as InteractionStatus,
      interaction.direction as InteractionDirection,
      interaction.channel,
      interaction.messageTemplate,
      interaction.messageContent,
      interaction.responseContent,
      interaction.responseIntent as ResponseIntent | null,
      interaction.scheduledFor,
      interaction.sentAt,
      interaction.deliveredAt,
      interaction.respondedAt,
      interaction.twilioMessageSid,
      interaction.twilioStatus,
      interaction.metadata as Record<string, unknown> | null,
      interaction.createdAt,
      interaction.updatedAt,
    );
  }

  static toPersistence(
    interaction: RequestInteractionEntity,
  ): Record<string, unknown> {
    return {
      id: interaction.id,
      requestId: interaction.requestId,
      interactionType: interaction.interactionType,
      status: interaction.status,
      direction: interaction.direction,
      channel: interaction.channel,
      messageTemplate: interaction.messageTemplate,
      messageContent: interaction.messageContent,
      responseContent: interaction.responseContent,
      responseIntent: interaction.responseIntent,
      scheduledFor: interaction.scheduledFor,
      sentAt: interaction.sentAt,
      deliveredAt: interaction.deliveredAt,
      respondedAt: interaction.respondedAt,
      twilioMessageSid: interaction.twilioMessageSid,
      twilioStatus: interaction.twilioStatus,
      metadata: interaction.metadata,
    };
  }
}

