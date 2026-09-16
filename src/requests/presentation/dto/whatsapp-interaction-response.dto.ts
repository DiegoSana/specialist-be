import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InteractionType,
  InteractionStatus,
  InteractionDirection,
  ResponseIntent,
} from '@prisma/client';
import { RequestInteractionEntity } from '../../domain/entities/request-interaction.entity';

/**
 * Response DTO for a single WhatsApp interaction (message) in the admin
 * conversations viewer. Never return the raw RequestInteractionEntity.
 */
export class WhatsAppInteractionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  requestId: string;

  @ApiProperty({ enum: InteractionType })
  interactionType: InteractionType;

  @ApiProperty({ enum: InteractionStatus })
  status: InteractionStatus;

  @ApiProperty({ enum: InteractionDirection })
  direction: InteractionDirection;

  @ApiProperty()
  channel: string;

  @ApiProperty()
  messageTemplate: string;

  @ApiProperty()
  messageContent: string;

  @ApiPropertyOptional()
  responseContent: string | null;

  @ApiPropertyOptional({ enum: ResponseIntent })
  responseIntent: ResponseIntent | null;

  @ApiProperty()
  scheduledFor: Date;

  @ApiPropertyOptional()
  sentAt: Date | null;

  @ApiPropertyOptional()
  deliveredAt: Date | null;

  @ApiPropertyOptional()
  respondedAt: Date | null;

  @ApiPropertyOptional()
  twilioMessageSid: string | null;

  @ApiPropertyOptional()
  twilioStatus: string | null;

  @ApiPropertyOptional({ type: 'object' })
  metadata: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(
    entity: RequestInteractionEntity,
  ): WhatsAppInteractionResponseDto {
    const dto = new WhatsAppInteractionResponseDto();
    dto.id = entity.id;
    dto.requestId = entity.requestId;
    dto.interactionType = entity.interactionType;
    dto.status = entity.status;
    dto.direction = entity.direction;
    dto.channel = entity.channel;
    dto.messageTemplate = entity.messageTemplate;
    dto.messageContent = entity.messageContent;
    dto.responseContent = entity.responseContent;
    dto.responseIntent = entity.responseIntent;
    dto.scheduledFor = entity.scheduledFor;
    dto.sentAt = entity.sentAt;
    dto.deliveredAt = entity.deliveredAt;
    dto.respondedAt = entity.respondedAt;
    dto.twilioMessageSid = entity.twilioMessageSid;
    dto.twilioStatus = entity.twilioStatus;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  static fromEntities(
    entities: RequestInteractionEntity[],
  ): WhatsAppInteractionResponseDto[] {
    return entities.map((e) => WhatsAppInteractionResponseDto.fromEntity(e));
  }
}
