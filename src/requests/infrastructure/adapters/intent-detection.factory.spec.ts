import { intentDetectionProvider } from './intent-detection.factory';
import { LocalIntentDetectionAdapter } from './local-intent-detection.adapter';
import { AnthropicIntentDetectionAdapter } from './anthropic-intent-detection.adapter';

describe('intentDetectionProvider', () => {
  const factory = (intentDetectionProvider as any).useFactory as (
    config: any,
    localUseCase: any,
    anthropicAdapter: any,
  ) => any;
  const mockLocalUseCase = { detectIntent: jest.fn() } as any;
  const mockAnthropicAdapter = {
    detectIntent: jest.fn(),
  } as unknown as AnthropicIntentDetectionAdapter;

  const makeConfig = (value?: string) => ({
    get: jest.fn((_key: string, def?: string) =>
      value !== undefined ? value : def,
    ),
  });

  it("returns LocalIntentDetectionAdapter when INTENT_CLASSIFIER_PROVIDER='local'", () => {
    const result = factory(
      makeConfig('local'),
      mockLocalUseCase,
      mockAnthropicAdapter,
    );

    expect(result).toBeInstanceOf(LocalIntentDetectionAdapter);
  });

  it("returns the injected AnthropicIntentDetectionAdapter when INTENT_CLASSIFIER_PROVIDER='anthropic'", () => {
    const result = factory(
      makeConfig('anthropic'),
      mockLocalUseCase,
      mockAnthropicAdapter,
    );

    expect(result).toBe(mockAnthropicAdapter);
  });

  it('defaults to LocalIntentDetectionAdapter when INTENT_CLASSIFIER_PROVIDER is unset (never silently call a paid API)', () => {
    const config = makeConfig(undefined);

    const result = factory(config, mockLocalUseCase, mockAnthropicAdapter);

    expect(result).toBeInstanceOf(LocalIntentDetectionAdapter);
    expect(config.get).toHaveBeenCalledWith(
      'INTENT_CLASSIFIER_PROVIDER',
      'local',
    );
  });

  it('defaults to LocalIntentDetectionAdapter for an unrecognized value', () => {
    const result = factory(
      makeConfig('carrier-pigeon'),
      mockLocalUseCase,
      mockAnthropicAdapter,
    );

    expect(result).toBeInstanceOf(LocalIntentDetectionAdapter);
  });
});
