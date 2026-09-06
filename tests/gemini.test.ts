import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeWithGemini, buildGeminiRequest, parseGeminiResult } from '../server/gemini.js';
import { resultFixture } from './fixtures.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const input = { mode: 'general' as const, instruction: 'Inspect both views.' };
const images = [
  { data: 'dGVzdA==', mimeType: 'image/jpeg' as const },
  { data: 'b3RoZXI=', mimeType: 'image/jpeg' as const },
];

describe('Gemini request and response pipeline', () => {
  it('builds numbered images and structured output with a separate system instruction', () => {
    const request = buildGeminiRequest(input, images, 'configured-model');
    expect(request.model).toBe('configured-model');
    expect(request.config?.responseMimeType).toBe('application/json');
    expect(request.config?.responseJsonSchema).toHaveProperty(
      'required',
      expect.arrayContaining(['summary', 'cannotDetermine']),
    );
    expect(request.config?.systemInstruction).toContain('Do not invent hidden conditions');
    expect(request.contents).toEqual([
      {
        role: 'user',
        parts: [
          { text: expect.stringContaining('Inspect both views.') },
          { text: 'Image 1:' },
          { inlineData: images[0] },
          { text: 'Image 2:' },
          { inlineData: images[1] },
        ],
      },
    ]);
  });
  it('uses the installed SDK to serialize the real HTTP contract and parses its response (transport mocked)', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'unit-test-only-not-a-real-key');
    vi.stubEnv('GEMINI_MODEL', 'test-vision-model');
    const transport = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { role: 'model', parts: [{ text: JSON.stringify(resultFixture) }] },
                finishReason: 'STOP',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', transport);
    const response = await analyzeWithGemini(input, images, new AbortController().signal);
    expect(response.result).toEqual(resultFixture);
    expect(response.model).toBe('test-vision-model');
    expect(transport).toHaveBeenCalledOnce();
    const args = transport.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(args[0])).toContain('test-vision-model:generateContent');
    const payload = JSON.parse(args[1].body as string);
    expect(payload.generationConfig.responseMimeType).toBe('application/json');
    expect(payload.generationConfig.responseJsonSchema.properties.observations.type).toBe('array');
    expect(payload.contents[0].parts[2].inlineData).toEqual(images[0]);
    expect(payload.systemInstruction.parts[0].text).toContain('Do not certify');
  });
  it('does not call the SDK without a configured key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    await expect(analyzeWithGemini(input, images, new AbortController().signal)).rejects.toMatchObject({
      code: 'MISSING_API_KEY',
    });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    '',
    '{}',
    'not JSON',
    '```json\n{}\n```',
    JSON.stringify({
      ...resultFixture,
      observations: [{ ...resultFixture.observations[0], imageRefs: [6] }],
    }),
  ])('rejects malformed or incomplete output: %s', (text) => {
    expect(() => parseGeminiResult(text, 2)).toThrow(
      expect.objectContaining({ code: 'INVALID_MODEL_OUTPUT' }),
    );
  });
  it('rejects safety-blocked and truncated responses even if text is valid JSON', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'unit-test-only-not-a-real-key');
    for (const finishReason of ['SAFETY', 'MAX_TOKENS']) {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                candidates: [{ content: { parts: [{ text: JSON.stringify(resultFixture) }] }, finishReason }],
              }),
              { status: 200 },
            ),
        ),
      );
      await expect(analyzeWithGemini(input, images, new AbortController().signal)).rejects.toMatchObject({
        code: 'INCOMPLETE_MODEL_OUTPUT',
      });
    }
  });
});
