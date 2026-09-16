import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  REQUEST_INTERACTION_QUERY_REPOSITORY,
  RequestInteractionQueryRepository,
  ConversationSummary,
} from '../../domain/queries/request-interaction.query-repository';
import {
  REQUEST_INTERACTION_REPOSITORY,
  RequestInteractionRepository,
} from '../../domain/repositories/request-interaction.repository';
import { RequestInteractionEntity } from '../../domain/entities/request-interaction.entity';
import { RequestInteractionService } from './request-interaction.service';
import { FollowUpSchedulerJob } from '../jobs/follow-up-scheduler.job';
import { FOLLOW_UP_RULES } from '../jobs/follow-up-scheduler.job';
import type { IFollowUpRule } from '../../domain/follow-up';
import { isWhatsAppDevMode } from './whatsapp-dev-mode';

export interface AdminWhatsAppConfig {
  devMode: boolean;
  availableFollowUpRules?: string[];
}

/**
 * Admin service for the WhatsApp conversations viewer and the local
 * (no-Twilio) test loop. `listConversations`/`getThread` are always
 * available (read-only). `simulateReply`/`triggerFollowUp` only work in dev
 * mode (see whatsapp-dev-mode.ts) - outside of it they 404, never 403, so a
 * production deployment reveals nothing about the feature's existence.
 */
@Injectable()
export class AdminWhatsAppService {
  constructor(
    @Inject(REQUEST_INTERACTION_QUERY_REPOSITORY)
    private readonly interactionQueryRepository: RequestInteractionQueryRepository,
    @Inject(REQUEST_INTERACTION_REPOSITORY)
    private readonly interactionRepository: RequestInteractionRepository,
    private readonly interactionService: RequestInteractionService,
    private readonly followUpScheduler: FollowUpSchedulerJob,
    private readonly config: ConfigService,
    @Inject(FOLLOW_UP_RULES)
    private readonly followUpRules: IFollowUpRule[],
  ) {}

  isDevMode(): boolean {
    return isWhatsAppDevMode(this.config);
  }

  getConfig(): AdminWhatsAppConfig {
    const devMode = this.isDevMode();
    return {
      devMode,
      availableFollowUpRules: devMode
        ? this.followUpRules.map((r) => r.getName())
        : undefined,
    };
  }

  async listConversations(params: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ items: ConversationSummary[]; total: number }> {
    const skip = (params.page - 1) * params.limit;
    return this.interactionQueryRepository.findConversations({
      skip,
      take: params.limit,
      search: params.search,
    });
  }

  async getThread(requestId: string): Promise<RequestInteractionEntity[]> {
    return this.interactionRepository.findByRequestId(requestId);
  }

  async simulateReply(
    requestId: string,
    body: string,
  ): Promise<RequestInteractionEntity | null> {
    if (!this.isDevMode()) {
      throw new NotFoundException('Not found');
    }

    const last =
      await this.interactionRepository.findMostRecentByRequestId(requestId);
    if (!last) {
      throw new NotFoundException(
        `No WhatsApp interaction found for request ${requestId}`,
      );
    }

    const recipientPhone = (last.metadata as any)?.recipientPhone;
    if (!recipientPhone) {
      throw new BadRequestException(
        `Interaction ${last.id} has no recipientPhone in metadata (message was never sent)`,
      );
    }

    if (!last.twilioMessageSid) {
      throw new BadRequestException(
        `Interaction ${last.id} has no message SID (it was never actually sent)`,
      );
    }

    // processInboundMessage returns void; re-fetch to return the updated interaction.
    await this.interactionService.processInboundMessage({
      from: `whatsapp:${recipientPhone}`,
      body,
      messageId: last.twilioMessageSid,
    });

    return this.interactionRepository.findById(last.id);
  }

  async triggerFollowUp(
    requestId: string,
    ruleName: string,
  ): Promise<{ interactionId: string }> {
    if (!this.isDevMode()) {
      throw new NotFoundException('Not found');
    }

    return this.followUpScheduler.forceTriggerRule(ruleName, requestId);
  }
}
