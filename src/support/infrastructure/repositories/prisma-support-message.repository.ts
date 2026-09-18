import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { SupportMessageRepository } from '../../domain/repositories/support-message.repository';
import { SupportMessageEntity } from '../../domain/entities/support-message.entity';
import { PrismaSupportMessageMapper } from '../mappers/support-message.prisma-mapper';

@Injectable()
export class PrismaSupportMessageRepository
  implements SupportMessageRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async add(message: SupportMessageEntity): Promise<SupportMessageEntity> {
    const data = PrismaSupportMessageMapper.toPersistence(message);

    const created = await this.prisma.supportMessage.create({
      data: data as any,
    });

    return PrismaSupportMessageMapper.toDomain(created);
  }

  async findByConversationId(
    conversationId: string,
  ): Promise<SupportMessageEntity[]> {
    const records = await this.prisma.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((r) => PrismaSupportMessageMapper.toDomain(r));
  }

  async findByTwilioMessageSid(
    twilioMessageSid: string,
  ): Promise<SupportMessageEntity | null> {
    const record = await this.prisma.supportMessage.findUnique({
      where: { twilioMessageSid },
    });

    if (!record) return null;

    return PrismaSupportMessageMapper.toDomain(record);
  }
}
