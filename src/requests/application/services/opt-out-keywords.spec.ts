import { isExplicitOptOutKeyword } from './opt-out-keywords';

describe('isExplicitOptOutKeyword', () => {
  it.each([
    'Quiero darme de BAJA por favor',
    'dame de baja',
    'DAR DE BAJA',
    'STOP',
    'stop',
    'Por favor STOP ya no me escriban',
    'cancelar suscripcion',
    'CANCELAR SUSCRIPCIÓN',
    'Quiero cancelar suscripcion a whatsapp',
  ])('detects explicit opt-out in "%s"', (text) => {
    expect(isExplicitOptOutKeyword(text)).toBe(true);
  });

  it.each([
    '',
    'si',
    'BAJA', // bare "BAJA" alone is too ambiguous in this domain to fast-path on
    'ya empecé el trabajo',
    'trabajo de baja tensión eléctrica', // "baja" as part of an unrelated compound term
    'no puedo hoy, mañana sigo',
  ])('does not flag unrelated text "%s"', (text) => {
    expect(isExplicitOptOutKeyword(text)).toBe(false);
  });
});
