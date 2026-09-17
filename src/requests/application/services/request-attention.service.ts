import { Inject, Injectable, Logger } from '@nestjs/common';
import { RequestAttentionReason } from '@prisma/client';
import {
  REQUEST_ATTENTION_FLAG_REPOSITORY,
  RequestAttentionFlagRepository,
} from '../../domain/repositories/request-attention-flag.repository';
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import { RequestAttentionFlaggedEvent } from '../../domain/events/request-attention-flagged.event';

/**
 * Single entry point for flagging a request as needing admin attention, for any of
 * the three reasons (AT_RISK, ABANDONED, ESCALATED). Idempotent: if an open flag with
 * the same (requestId, reason) already exists, does nothing — this is what prevents the
 * follow-up scheduler re-triggering every ~1 day from spamming duplicate flags/notifications.
 */
@Injectable()
export class RequestAttentionService {
  private readonly logger = new Logger(RequestAttentionService.name);

  constructor(
    @Inject(REQUEST_ATTENTION_FLAG_REPOSITORY)
    private readonly attentionFlagRepository: RequestAttentionFlagRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: EventBus,
  ) {}

  async flag(
    requestId: string,
    reason: RequestAttentionReason,
    detail: string | null = null,
  ): Promise<void> {
    const alreadyOpen =
      await this.attentionFlagRepository.hasOpenByRequestAndReason(
        requestId,
        reason,
      );
    if (alreadyOpen) {
      this.logger.debug(
        `Request ${requestId} already has an open ${reason} flag, skipping`,
      );
      return;
    }

    const attentionFlag = await this.attentionFlagRepository.add({
      requestId,
      reason,
      detail,
    });

    this.logger.log(
      `Flagged request ${requestId} for attention: ${reason}${detail ? ` (${detail})` : ''}`,
    );

    await this.eventBus.publish(
      new RequestAttentionFlaggedEvent({
        attentionFlagId: attentionFlag.id,
        requestId,
        reason,
        detail,
      }),
    );
  }
}
