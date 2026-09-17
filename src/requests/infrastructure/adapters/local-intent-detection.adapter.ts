import { Injectable } from '@nestjs/common';
import {
  IntentDetectionInput,
  IntentDetectionPort,
  IntentDetectionResult,
} from '../../domain/ports/intent-detection.port';
import { DetectResponseIntentUseCase } from '../../application/use-cases/detect-response-intent.use-case';

/**
 * Local (no-LLM) intent detection adapter for development, testing, and as the
 * deterministic fallback when the real classifier fails or times out.
 *
 * Wraps the existing keyword-matching DetectResponseIntentUseCase for statusIntent;
 * it has no way to detect non-explicit opt-out or evasive/abandoned viability signals
 * (those require an LLM), so those fields are always the safe defaults.
 */
@Injectable()
export class LocalIntentDetectionAdapter implements IntentDetectionPort {
  constructor(
    private readonly detectResponseIntentUseCase: DetectResponseIntentUseCase,
  ) {}

  async detectIntent(
    input: IntentDetectionInput,
  ): Promise<IntentDetectionResult> {
    return {
      statusIntent: this.detectResponseIntentUseCase.detectIntent(
        input.messageText,
      ),
      confidence: 1,
      viability: null,
      optOut: false,
      escalate: false,
    };
  }
}
