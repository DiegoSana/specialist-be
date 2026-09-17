import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntentDetectionInput,
  IntentDetectionPort,
  IntentDetectionResult,
} from '../../domain/ports/intent-detection.port';

/**
 * Anthropic-backed intent detection adapter.
 *
 * Stub for now (Phase 1 of the WhatsApp AI follow-up plan) — wired into the module and
 * factory so INTENT_CLASSIFIER_PROVIDER=anthropic resolves to a real provider, but the
 * actual API call (structured output via forced tool use, timeout, error wrapping) is
 * implemented in a later phase. Never selected by default (see intent-detection.factory.ts),
 * so `npm test`/dev never depend on this being finished.
 */
@Injectable()
export class AnthropicIntentDetectionAdapter implements IntentDetectionPort {
  private readonly logger = new Logger(AnthropicIntentDetectionAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async detectIntent(
    input: IntentDetectionInput,
  ): Promise<IntentDetectionResult> {
    this.logger.error(
      `AnthropicIntentDetectionAdapter is not implemented yet (INTENT_CLASSIFIER_PROVIDER=anthropic is not ready for use). Dropped message: "${input.messageText}"`,
    );
    throw new Error('AnthropicIntentDetectionAdapter is not implemented yet');
  }
}
