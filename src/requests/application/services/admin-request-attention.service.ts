import { Inject, Injectable } from '@nestjs/common';
import {
  REQUEST_ATTENTION_QUERY_REPOSITORY,
  RequestAttentionQueryRepository,
  AttentionFlagSummary,
} from '../../domain/queries/request-attention.query-repository';
import {
  REQUEST_ATTENTION_FLAG_REPOSITORY,
  RequestAttentionFlagRepository,
} from '../../domain/repositories/request-attention-flag.repository';
import { RequestAttentionFlagEntity } from '../../domain/entities/request-attention-flag.entity';

/**
 * Backs the admin "needs attention" panel — read-only listing plus the one
 * mutation (resolve). Reachable only through AdminGuard-protected routes, so
 * (like AdminWhatsAppService) it doesn't re-check permissions itself.
 */
@Injectable()
export class AdminRequestAttentionService {
  constructor(
    @Inject(REQUEST_ATTENTION_QUERY_REPOSITORY)
    private readonly attentionQueryRepository: RequestAttentionQueryRepository,
    @Inject(REQUEST_ATTENTION_FLAG_REPOSITORY)
    private readonly attentionFlagRepository: RequestAttentionFlagRepository,
  ) {}

  async listOpen(params: {
    page: number;
    limit: number;
  }): Promise<{ items: AttentionFlagSummary[]; total: number }> {
    const skip = (params.page - 1) * params.limit;
    return this.attentionQueryRepository.findAllOpen({
      skip,
      take: params.limit,
    });
  }

  async resolve(
    id: string,
    adminUserId: string,
  ): Promise<RequestAttentionFlagEntity> {
    return this.attentionFlagRepository.resolve(id, adminUserId);
  }
}
