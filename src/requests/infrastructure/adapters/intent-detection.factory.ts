import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INTENT_DETECTION_PORT,
  IntentDetectionPort,
} from '../../domain/ports/intent-detection.port';
import { LocalIntentDetectionAdapter } from './local-intent-detection.adapter';
import { AnthropicIntentDetectionAdapter } from './anthropic-intent-detection.adapter';
import { DetectResponseIntentUseCase } from '../../application/use-cases/detect-response-intent.use-case';

export type IntentClassifierProviderType = 'anthropic' | 'local';

/**
 * Factory provider that creates the appropriate IntentDetectionPort based on the
 * INTENT_CLASSIFIER_PROVIDER environment variable.
 *
 * - 'local' (default): deterministic keyword matching, no network. Unlike
 *   WHATSAPP_PROVIDER (which defaults to the real Twilio adapter so production never
 *   silently fails to send), this defaults to 'local' on purpose: silently calling a
 *   paid, network-dependent LLM on every inbound webhook in an unconfigured environment
 *   is a worse failure mode than degrading to keyword matching. Production must opt in
 *   explicitly via INTENT_CLASSIFIER_PROVIDER=anthropic.
 * - 'anthropic': uses AnthropicIntentDetectionAdapter (real LLM call).
 */
export const intentDetectionProvider: Provider = {
  provide: INTENT_DETECTION_PORT,
  useFactory: (
    config: ConfigService,
    localUseCase: DetectResponseIntentUseCase,
    anthropicAdapter: AnthropicIntentDetectionAdapter,
  ): IntentDetectionPort => {
    const provider = config.get<IntentClassifierProviderType>(
      'INTENT_CLASSIFIER_PROVIDER',
      'local',
    );

    switch (provider) {
      case 'anthropic':
        return anthropicAdapter;
      case 'local':
      default:
        return new LocalIntentDetectionAdapter(localUseCase);
    }
  },
  inject: [
    ConfigService,
    DetectResponseIntentUseCase,
    AnthropicIntentDetectionAdapter,
  ],
};
