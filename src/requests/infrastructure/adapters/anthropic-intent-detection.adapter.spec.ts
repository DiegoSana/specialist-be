import { RequestStatus } from '@prisma/client';

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { AnthropicIntentDetectionAdapter } from './anthropic-intent-detection.adapter';

describe('AnthropicIntentDetectionAdapter', () => {
  let adapter: AnthropicIntentDetectionAdapter;
  let mockConfig: { get: jest.Mock };

  const baseInput = {
    messageText: 'si, ya empecé',
    currentStatus: RequestStatus.CONTACT_RELEASED,
    triggeringTemplate: 'follow_up_3_days',
    conversationHistory: [],
  };

  const toolUseResponse = (input: Record<string, unknown>) => ({
    content: [{ type: 'tool_use', name: 'classify_whatsapp_reply', input }],
  });

  beforeEach(() => {
    mockCreate.mockReset();
    mockConfig = {
      get: jest.fn((key: string, def?: unknown) =>
        key === 'ANTHROPIC_API_KEY' ? 'test-api-key' : def,
      ),
    };
    adapter = new AnthropicIntentDetectionAdapter(mockConfig as any);
  });

  it('classifies via forced tool use and maps a valid response', async () => {
    mockCreate.mockResolvedValue(
      toolUseResponse({
        statusIntent: 'STARTED',
        confidence: 0.92,
        viability: 'ACTIVE',
        optOut: false,
        escalate: false,
      }),
    );

    const result = await adapter.detectIntent(baseInput);

    expect(result).toEqual({
      statusIntent: 'STARTED',
      confidence: 0.92,
      viability: 'ACTIVE',
      optOut: false,
      escalate: false,
    });

    const [params, options] = mockCreate.mock.calls[0];
    expect(params.tool_choice).toEqual({
      type: 'tool',
      name: 'classify_whatsapp_reply',
    });
    expect(params.tools).toHaveLength(1);
    expect(params.tools[0].name).toBe('classify_whatsapp_reply');
    expect(options.maxRetries).toBe(0);
    expect(typeof options.timeout).toBe('number');
  });

  it('maps a null viability through unchanged', async () => {
    mockCreate.mockResolvedValue(
      toolUseResponse({
        statusIntent: 'UNKNOWN',
        confidence: 0.4,
        viability: null,
        optOut: false,
        escalate: false,
      }),
    );

    const result = await adapter.detectIntent(baseInput);

    expect(result.viability).toBeNull();
  });

  it('wraps SDK/network errors into a plain Error and never leaks SDK types', async () => {
    mockCreate.mockRejectedValue(new Error('connection reset'));

    await expect(adapter.detectIntent(baseInput)).rejects.toThrow(
      /Anthropic intent classification failed/,
    );
  });

  it('throws when no tool_use block is present in the response', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'huh' }] });

    await expect(adapter.detectIntent(baseInput)).rejects.toThrow(
      /Anthropic intent classification failed/,
    );
  });

  it('throws when the response has an invalid statusIntent', async () => {
    mockCreate.mockResolvedValue(
      toolUseResponse({
        statusIntent: 'NOT_A_REAL_INTENT',
        confidence: 0.9,
        viability: null,
        optOut: false,
        escalate: false,
      }),
    );

    await expect(adapter.detectIntent(baseInput)).rejects.toThrow(
      /Anthropic intent classification failed/,
    );
  });

  it('throws when ANTHROPIC_API_KEY is not configured', async () => {
    mockConfig.get.mockImplementation((key: string, def?: unknown) =>
      key === 'ANTHROPIC_API_KEY' ? undefined : def,
    );

    await expect(adapter.detectIntent(baseInput)).rejects.toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });
});
