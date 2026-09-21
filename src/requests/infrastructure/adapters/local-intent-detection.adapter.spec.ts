import {
  ResponseIntent,
  InteractionDirection,
  RequestStatus,
} from '@prisma/client';
import { LocalIntentDetectionAdapter } from './local-intent-detection.adapter';
import { DetectResponseIntentUseCase } from '../../application/use-cases/detect-response-intent.use-case';

describe('LocalIntentDetectionAdapter', () => {
  let adapter: LocalIntentDetectionAdapter;
  let mockUseCase: jest.Mocked<
    Pick<DetectResponseIntentUseCase, 'detectIntent'>
  >;

  beforeEach(() => {
    mockUseCase = { detectIntent: jest.fn() };
    adapter = new LocalIntentDetectionAdapter(mockUseCase as any);
  });

  it('delegates statusIntent to DetectResponseIntentUseCase and returns safe defaults for the rest', async () => {
    mockUseCase.detectIntent.mockReturnValue(ResponseIntent.CONFIRMED);

    const result = await adapter.detectIntent({
      messageText: 'si',
      currentStatus: RequestStatus.CONTACT_RELEASED,
      triggeringTemplate: 'follow_up_3_days',
      conversationHistory: [
        {
          direction: InteractionDirection.TO_PROVIDER,
          content: 'Hola! ¿Ya empezaste?',
          createdAt: new Date(),
        },
      ],
    });

    expect(mockUseCase.detectIntent).toHaveBeenCalledWith('si');
    expect(result).toEqual({
      statusIntent: ResponseIntent.CONFIRMED,
      confidence: 1,
      viability: null,
      optOut: false,
      escalate: false,
    });
  });

  it('never detects opt-out or viability signals (no LLM available)', async () => {
    mockUseCase.detectIntent.mockReturnValue(ResponseIntent.UNKNOWN);

    const result = await adapter.detectIntent({
      messageText: 'dejen de escribirme, estoy viendo otras opciones',
      currentStatus: RequestStatus.PUBLISHED,
      triggeringTemplate: null,
      conversationHistory: [],
    });

    expect(result.optOut).toBe(false);
    expect(result.viability).toBeNull();
    expect(result.escalate).toBe(false);
  });
});
