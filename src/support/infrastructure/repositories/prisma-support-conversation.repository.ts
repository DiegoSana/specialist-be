import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  SupportConversationListFilter,
  SupportConversationRepository,
} from '../../domain/repositories/support-conversation.repository';
import { SupportConversationEntity } from '../../domain/entities/support-conversation.entity';
import { PrismaSupportConversationMapper } from '../mappers/support-conversation.prisma-mapper';

@Injectable()
export class PrismaSupportConversationRepository
  implements SupportConversationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SupportConversationEntity | null> {
    const record = await this.prisma.supportConversation.findUnique({
      where: { id },
    });

    if (!record) return null;

    return PrismaSupportConversationMapper.toDomain(record);
  }

  async findByPhoneNumber(
    phoneNumber: string,
  ): Promise<SupportConversationEntity | null> {
    const record = await this.prisma.supportConversation.findUnique({
      where: { phoneNumber },
    });

    if (!record) return null;

    return PrismaSupportConversationMapper.toDomain(record);
  }

  async findManyForAdmin(
    filter: SupportConversationListFilter,
  ): Promise<{ items: SupportConversationEntity[]; total: number }> {
    const where = filter.status ? { status: filter.status } : {};

    const [records, total] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.supportConversation.count({ where }),
    ]);

    return {
      items: records.map((r) => PrismaSupportConversationMapper.toDomain(r)),
      total,
    };
  }

  async save(
    conversation: SupportConversationEntity,
  ): Promise<SupportConversationEntity> {
    const data = PrismaSupportConversationMapper.toPersistence(conversation);

    const saved = await this.prisma.supportConversation.upsert({
      where: { id: conversation.id },
      create: data as any,
      update: data as any,
    });

    return PrismaSupportConversationMapper.toDomain(saved);
  }
}
