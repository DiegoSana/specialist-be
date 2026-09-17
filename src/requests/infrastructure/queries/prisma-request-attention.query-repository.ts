import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  AttentionFlagSummary,
  RequestAttentionQueryRepository,
} from '../../domain/queries/request-attention.query-repository';

@Injectable()
export class PrismaRequestAttentionQueryRepository
  implements RequestAttentionQueryRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findAllOpen(params: {
    skip: number;
    take: number;
  }): Promise<{ items: AttentionFlagSummary[]; total: number }> {
    const where = { resolvedAt: null };

    const [rows, total] = await Promise.all([
      this.prisma.requestAttentionFlag.findMany({
        where,
        include: {
          request: { select: { title: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.requestAttentionFlag.count({ where }),
    ]);

    const items: AttentionFlagSummary[] = rows.map((row) => ({
      id: row.id,
      requestId: row.requestId,
      requestTitle: row.request.title || 'Sin título',
      requestStatus: row.request.status,
      reason: row.reason,
      detail: row.detail,
      createdAt: row.createdAt,
    }));

    return { items, total };
  }
}
