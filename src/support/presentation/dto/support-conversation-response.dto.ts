import { ApiProperty } from '@nestjs/swagger';
import { SupportConversationStatus } from '@prisma/client';
import { SupportConversationEntity } from '../../domain/entities/support-conversation.entity';

export class SupportConversationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ nullable: true })
  userId: string | null;

  @ApiProperty({ nullable: true })
  relatedRequestId: string | null;

  @ApiProperty({ enum: SupportConversationStatus })
  status: SupportConversationStatus;

  @ApiProperty({ nullable: true })
  lastInboundAt: Date | null;

  @ApiProperty({ nullable: true })
  lastOutboundAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  resolvedAt: Date | null;

  @ApiProperty({ nullable: true })
  resolvedByUserId: string | null;

  @ApiProperty({
    description:
      'Computed server-side from the WhatsApp Business API 24h reply window - the ' +
      'frontend must never reimplement this logic.',
  })
  canReplyNow: boolean;

  static fromEntity(
    conversation: SupportConversationEntity,
    now: Date = new Date(),
  ): SupportConversationResponseDto {
    const dto = new SupportConversationResponseDto();
    dto.id = conversation.id;
    dto.phoneNumber = conversation.phoneNumber;
    dto.userId = conversation.userId;
    dto.relatedRequestId = conversation.relatedRequestId;
    dto.status = conversation.status;
    dto.lastInboundAt = conversation.lastInboundAt;
    dto.lastOutboundAt = conversation.lastOutboundAt;
    dto.createdAt = conversation.createdAt;
    dto.updatedAt = conversation.updatedAt;
    dto.resolvedAt = conversation.resolvedAt;
    dto.resolvedByUserId = conversation.resolvedByUserId;
    dto.canReplyNow = conversation.isWithinReplyWindow(now);
    return dto;
  }
}
