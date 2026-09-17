import * as path from 'path';
import { promises as fs } from 'fs';
import { MessageTemplateService } from './message-template.service';

jest.mock('fs', () => ({
  promises: { readFile: jest.fn() },
}));

const mockReadFile = fs.readFile as jest.Mock;

const SAMPLE_TEMPLATES = JSON.stringify({
  follow_up_5_days_in_progress: {
    es: 'Hola {title}, van 5 días',
    en: 'Hi {title}, 5 days in',
  },
});

const distPath = path.join(
  process.cwd(),
  'dist',
  'shared',
  'infrastructure',
  'messaging',
  'message-templates.json',
);

describe('MessageTemplateService', () => {
  let service: MessageTemplateService;

  beforeEach(() => {
    service = new MessageTemplateService();
    mockReadFile.mockReset();
  });

  it('resolves templates from process.cwd()/dist first — the layout the webpack production bundle actually produces (see message-template.service.ts comment: __dirname at runtime is just dist/, not the pre-bundle src/ directory structure)', async () => {
    mockReadFile.mockImplementation((p: string) =>
      p === distPath
        ? Promise.resolve(SAMPLE_TEMPLATES)
        : Promise.reject(
            Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
          ),
    );

    const result = await service.getTemplate(
      'follow_up_5_days_in_progress',
      'es',
      {
        title: 'Juan',
      },
    );

    expect(result).toBe('Hola Juan, van 5 días');
    expect(mockReadFile).toHaveBeenCalledWith(distPath, 'utf-8');
  });

  it('falls back to a __dirname-relative path when the dist path is unavailable (non-bundled dev build)', async () => {
    const devPath = path.join(__dirname, 'message-templates.json');
    mockReadFile.mockImplementation((p: string) =>
      p === devPath
        ? Promise.resolve(SAMPLE_TEMPLATES)
        : Promise.reject(
            Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
          ),
    );

    const result = await service.getTemplate(
      'follow_up_5_days_in_progress',
      'en',
    );

    expect(result).toBe('Hi {title}, 5 days in');
    expect(mockReadFile).toHaveBeenCalledWith(devPath, 'utf-8');
  });

  it('returns the "not found" fallback string (never throws) when no candidate path resolves', async () => {
    mockReadFile.mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

    const result = await service.getTemplate(
      'follow_up_5_days_in_progress',
      'es',
    );

    expect(result).toBe('[Template follow_up_5_days_in_progress not found]');
  });

  it('returns the "not found" fallback for an unknown template key once templates are loaded', async () => {
    mockReadFile.mockImplementation((p: string) =>
      p === distPath
        ? Promise.resolve(SAMPLE_TEMPLATES)
        : Promise.reject(
            Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
          ),
    );

    const result = await service.getTemplate('nonexistent_template', 'es');

    expect(result).toBe('[Template nonexistent_template not found]');
  });

  it('only reads the templates file once across concurrent/successive calls', async () => {
    mockReadFile.mockImplementation((p: string) =>
      p === distPath
        ? Promise.resolve(SAMPLE_TEMPLATES)
        : Promise.reject(
            Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
          ),
    );

    await Promise.all([
      service.getTemplate('follow_up_5_days_in_progress', 'es'),
      service.getTemplate('follow_up_5_days_in_progress', 'en'),
    ]);
    await service.getTemplate('follow_up_5_days_in_progress', 'es');

    const distReads = mockReadFile.mock.calls.filter(([p]) => p === distPath);
    expect(distReads).toHaveLength(1);
  });
});
