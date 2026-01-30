import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RequestInteractionRepository } from '../../domain/repositories/request-interaction.repository';
import { RequestInteractionEntity } from '../../domain/entities/request-interaction.entity';
import { InteractionStatus } from '@prisma/client';
import { PrismaRequestInteractionMapper } from '../mappers/request-interaction.prisma-mapper';

@Injectable()
export class PrismaRequestInteractionRepository
  implements RequestInteractionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<RequestInteractionEntity | null> {
    const interaction = await this.prisma.requestInteraction.findUnique({
      where: { id },
    });

    if (!interaction) return null;

    return PrismaRequestInteractionMapper.toDomain(interaction);
  }

  async findByRequestId(
    requestId: string,
  ): Promise<RequestInteractionEntity[]> {
    const interactions = await this.prisma.requestInteraction.findMany({
      where: { requestId },
      orderBy: { createdAt: 'desc' },
    });

    return interactions.map((i) => PrismaRequestInteractionMapper.toDomain(i));
  }

  async findPendingFollowUps(
    now: Date,
  ): Promise<RequestInteractionEntity[]> {
    const interactions = await this.prisma.requestInteraction.findMany({
      where: {
        status: InteractionStatus.PENDING,
        scheduledFor: {
          lte: now,
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    return interactions.map((i) => PrismaRequestInteractionMapper.toDomain(i));
  }

  async findByTwilioMessageSid(
    messageSid: string,
  ): Promise<RequestInteractionEntity | null> {
    const interaction =
      await this.prisma.requestInteraction.findUnique({
        where: { twilioMessageSid: messageSid },
      });

    if (!interaction) return null;

    return PrismaRequestInteractionMapper.toDomain(interaction);
  }

  async findMostRecentByRequestAndPhone(
    requestId: string,
    phoneNumber: string,
  ): Promise<RequestInteractionEntity | null> {
    // Search for interaction with recipientPhone in metadata
    // Prisma JSON filtering: metadata->>'recipientPhone' = phoneNumber
    const interaction = await this.prisma.requestInteraction.findFirst({
      where: {
        requestId,
        metadata: {
          path: ['recipientPhone'],
          equals: phoneNumber,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!interaction) return null;

    return PrismaRequestInteractionMapper.toDomain(interaction);
  }

  async findMostRecentByPhone(
    phoneNumber: string,
  ): Promise<RequestInteractionEntity | null> {
    // Find most recent interaction (pending or delivered) for this phone number
    // This is used when we receive a message but don't know which request it's for
    const interaction = await this.prisma.requestInteraction.findFirst({
      where: {
        metadata: {
          path: ['recipientPhone'],
          equals: phoneNumber,
        },
        status: {
          in: [
            InteractionStatus.PENDING,
            InteractionStatus.SENT,
            InteractionStatus.DELIVERED,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!interaction) return null;

    return PrismaRequestInteractionMapper.toDomain(interaction);
  }

  async hasPendingFollowUp(requestId: string): Promise<boolean> {
    const count = await this.prisma.requestInteraction.count({
      where: {
        requestId,
        interactionType: 'FOLLOW_UP',
        status: InteractionStatus.PENDING,
      },
    });

    return count > 0;
  }

  async findMostRecentByRequestId(
    requestId: string,
  ): Promise<RequestInteractionEntity | null> {
    const interaction = await this.prisma.requestInteraction.findFirst({
      where: { requestId },
      orderBy: { createdAt: 'desc' },
    });

    if (!interaction) return null;

    return PrismaRequestInteractionMapper.toDomain(interaction);
  }

  async findFailedRetryable(
    now: Date,
  ): Promise<RequestInteractionEntity[]> {
    // Find failed interactions that have nextRetryAt in metadata and it's time to retry
    // We need to filter by status FAILED and check metadata->>'nextRetryAt' <= now
    const interactions = await this.prisma.requestInteraction.findMany({
      where: {
        status: InteractionStatus.FAILED,
        metadata: {
          path: ['nextRetryAt'],
          not: null,
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    // Filter in memory because Prisma doesn't support date comparison in JSON fields easily
    // This is acceptable since we expect a small number of failed interactions
    const retryable = interactions.filter((interaction) => {
      const metadata = interaction.metadata as any;
      const nextRetryAt = metadata?.nextRetryAt;
      if (!nextRetryAt) return false;

      const nextRetryDate = new Date(nextRetryAt);
      return nextRetryDate <= now;
    });

    return retryable.map((i) => PrismaRequestInteractionMapper.toDomain(i));
  }

  async findSentButNotDelivered(
    sentAfter: Date,
  ): Promise<RequestInteractionEntity[]> {
    const interactions = await this.prisma.requestInteraction.findMany({
      where: {
        status: InteractionStatus.SENT,
        twilioMessageSid: { not: null },
        sentAt: { gte: sentAfter },
        deliveredAt: null,
      },
      orderBy: { sentAt: 'asc' },
    });

    return interactions.map((i) => PrismaRequestInteractionMapper.toDomain(i));
  }

  async save(
    interaction: RequestInteractionEntity,
  ): Promise<RequestInteractionEntity> {
    const data = PrismaRequestInteractionMapper.toPersistence(interaction);

    const saved = await this.prisma.requestInteraction.upsert({
      where: { id: interaction.id },
      create: data as any,
      update: data as any,
    });

    return PrismaRequestInteractionMapper.toDomain(saved);
  }
}

