import { ApiProperty } from '@nestjs/swagger';
import { SupportMessageDirection } from '@prisma/client';
import { SupportMessageEntity } from '../../domain/entities/support-message.entity';

export class SupportMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  conversationId: string;

  @ApiProperty({ enum: SupportMessageDirection })
  direction: SupportMessageDirection;

  @ApiProperty()
  body: string;

  @ApiProperty({ nullable: true })
  twilioMessageSid: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Admin user id that sent this message, for OUTBOUND messages.',
  })
  sentByUserId: string | null;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(message: SupportMessageEntity): SupportMessageResponseDto {
    const dto = new SupportMessageResponseDto();
    dto.id = message.id;
    dto.conversationId = message.conversationId;
    dto.direction = message.direction;
    dto.body = message.body;
    dto.twilioMessageSid = message.twilioMessageSid;
    dto.sentByUserId = message.sentByUserId;
    dto.createdAt = message.createdAt;
    return dto;
  }
}
