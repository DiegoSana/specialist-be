import { ResponseIntent } from '@prisma/client';
import { DetectResponseIntentUseCase } from './detect-response-intent.use-case';

describe('DetectResponseIntentUseCase', () => {
  let useCase: DetectResponseIntentUseCase;

  beforeEach(() => {
    useCase = new DetectResponseIntentUseCase();
  });

  it('returns UNKNOWN for empty text', () => {
    expect(useCase.detectIntent('')).toBe(ResponseIntent.UNKNOWN);
  });

  it.each(['si', 'sí', 'ok', 'confirmo', 'perfecto', 'listo'])(
    'detects CONFIRMED for "%s"',
    (text) => {
      expect(useCase.detectIntent(text)).toBe(ResponseIntent.CONFIRMED);
    },
  );

  it.each(['empecé', 'ya empecé', 'comence', 'started'])(
    'detects STARTED for "%s"',
    (text) => {
      expect(useCase.detectIntent(text)).toBe(ResponseIntent.STARTED);
    },
  );

  it.each(['terminé', 'finalizado', 'completado', 'done'])(
    'detects COMPLETED for "%s"',
    (text) => {
      expect(useCase.detectIntent(text)).toBe(ResponseIntent.COMPLETED);
    },
  );

  it.each(['cancelar', 'no puedo', 'no gracias'])(
    'detects CANCELLED for "%s"',
    (text) => {
      expect(useCase.detectIntent(text)).toBe(ResponseIntent.CANCELLED);
    },
  );

  it.each(['información', 'tengo una duda', 'question'])(
    'detects NEEDS_INFO for "%s"',
    (text) => {
      expect(useCase.detectIntent(text)).toBe(ResponseIntent.NEEDS_INFO);
    },
  );

  it('returns UNKNOWN when nothing matches', () => {
    expect(useCase.detectIntent('mañana te cuento')).toBe(
      ResponseIntent.UNKNOWN,
    );
  });

  it('CONFIRMED takes precedence over CANCELLED when both keyword sets match', () => {
    // "no" is a CANCELLED keyword, but the confirmed-keyword check runs first
    expect(useCase.detectIntent('si, no hay problema')).toBe(
      ResponseIntent.CONFIRMED,
    );
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(useCase.detectIntent('  SI  ')).toBe(ResponseIntent.CONFIRMED);
  });
});
