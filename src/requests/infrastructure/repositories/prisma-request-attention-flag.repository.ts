import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestAttentionReason } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RequestAttentionFlagRepository } from '../../domain/repositories/request-attention-flag.repository';
import { RequestAttentionFlagEntity } from '../../domain/entities/request-attention-flag.entity';

@Injectable()
export class PrismaRequestAttentionFlagRepository
  implements RequestAttentionFlagRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private mapToDomain(raw: {
    id: string;
    requestId: string;
    reason: RequestAttentionReason;
    detail: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
    resolvedByUserId: string | null;
  }): RequestAttentionFlagEntity {
    return new RequestAttentionFlagEntity(
      raw.id,
      raw.requestId,
      raw.reason,
      raw.detail,
      raw.createdAt,
      raw.resolvedAt,
      raw.resolvedByUserId,
    );
  }

  async hasOpenByRequestAndReason(
    requestId: string,
    reason: RequestAttentionReason,
  ): Promise<boolean> {
    const count = await this.prisma.requestAttentionFlag.count({
      where: { requestId, reason, resolvedAt: null },
    });
    return count > 0;
  }

  async add(data: {
    requestId: string;
    reason: RequestAttentionReason;
    detail: string | null;
  }): Promise<RequestAttentionFlagEntity> {
    const flag = await this.prisma.requestAttentionFlag.create({
      data: {
        requestId: data.requestId,
        reason: data.reason,
        detail: data.detail,
      },
    });
    return this.mapToDomain(flag);
  }

  async findById(id: string): Promise<RequestAttentionFlagEntity | null> {
    const flag = await this.prisma.requestAttentionFlag.findUnique({
      where: { id },
    });
    return flag ? this.mapToDomain(flag) : null;
  }

  async resolve(
    id: string,
    resolvedByUserId: string,
    now: Date = new Date(),
  ): Promise<RequestAttentionFlagEntity> {
    try {
      const flag = await this.prisma.requestAttentionFlag.update({
        where: { id },
        data: { resolvedAt: now, resolvedByUserId },
      });
      return this.mapToDomain(flag);
    } catch {
      throw new NotFoundException(`RequestAttentionFlag ${id} not found`);
    }
  }
}
