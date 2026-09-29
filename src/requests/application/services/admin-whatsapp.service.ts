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
import type { WhatsAppProviderType } from '../../../shared/infrastructure/messaging/whatsapp-messaging.factory';

// Mirrors the fallback in TwilioWhatsAppAdapter (twilio-whatsapp.adapter.ts),
// which isn't exported from there. Keep the two literals in sync.
const DEFAULT_SANDBOX_WHATSAPP_FROM = 'whatsapp:+14155238886';

export interface AdminWhatsAppConfig {
  provider: WhatsAppProviderType;
  devMode: boolean;
  availableFollowUpRules: string[];
  twilio?: {
    fromNumber: string;
    isDefaultSandboxNumber: boolean;
  };
}

/**
 * Admin service for the WhatsApp conversations viewer, the "trigger a
 * follow-up now" admin action, and the local (no-Twilio) test loop.
 * `listConversations`/`getThread` are always available (read-only).
 * `triggerFollowUp` is always available too, regardless of provider: it only
 * schedules a PENDING interaction (`FollowUpSchedulerJob.forceTriggerRule`),
 * the actual send still goes through the normal dispatch job/provider
 * adapter, so it's a legitimate "send this now" admin action rather than a
 * Twilio-simulation hack. `simulateReply` is the one exception and only works
 * in dev mode (see whatsapp-dev-mode.ts) - outside of it it 404s, never 403s,
 * so a production deployment reveals nothing about the feature's existence:
 * against a real Twilio number, real inbound replies arrive via the
 * `/api/webhooks/twilio` webhook, so faking one doesn't make sense and could
 * desync state.
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
    const provider = this.config.get<WhatsAppProviderType>(
      'WHATSAPP_PROVIDER',
      'twilio',
    );

    let twilio: AdminWhatsAppConfig['twilio'];
    if (provider === 'twilio') {
      const fromNumber =
        this.config.get<string>('TWILIO_WHATSAPP_FROM') ||
        DEFAULT_SANDBOX_WHATSAPP_FROM;
      twilio = {
        fromNumber,
        isDefaultSandboxNumber: fromNumber === DEFAULT_SANDBOX_WHATSAPP_FROM,
      };
    }

    return {
      provider,
      devMode,
      availableFollowUpRules: this.followUpRules.map((r) => r.getName()),
      twilio,
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
    return this.followUpScheduler.forceTriggerRule(ruleName, requestId);
  }
}
