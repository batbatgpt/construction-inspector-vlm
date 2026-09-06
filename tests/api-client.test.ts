import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAnalysis } from '../client/src/lib/api.js';
import { LIMITS } from '../shared/config.js';
import { reportFixture } from './fixtures.js';

afterEach(() => vi.unstubAllGlobals());

describe('hosted upload contract', () => {
  it('keeps a maximum-size six-image multipart request below the request budget', async () => {
    let bytesLeft: number = LIMITS.maxTotalBytes;
    const files = Array.from({ length: LIMITS.maxImages }, (_, index) => {
      const size = Math.floor(bytesLeft / (LIMITS.maxImages - index));
      bytesLeft -= size;
      return new File([new Uint8Array(size)], `${'long-name'.repeat(1000)}.png`, { type: 'image/png' });
    });
    let bodySize = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options: RequestInit) => {
        const form = options.body as FormData;
        expect(form.getAll('images').map((file) => (file as File).name)).toEqual(
          Array.from({ length: 6 }, (_, index) => `image-${index + 1}`),
        );
        bodySize = (await new Response(form).arrayBuffer()).byteLength;
        return new Response(JSON.stringify(reportFixture));
      }),
    );
    await requestAnalysis(
      { mode: 'custom', instruction: '字'.repeat(LIMITS.maxInstructionChars) },
      files,
      new AbortController().signal,
    );
    expect(bodySize).toBeGreaterThan(LIMITS.maxTotalBytes);
    expect(bodySize).toBeLessThan(LIMITS.maxRequestBytes);
  });

  it.each([
    [413, '3.5 MiB combined'],
    [504, 'timed out'],
  ] as const)('explains plain-text platform HTTP %s errors', async (status, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('PLATFORM_ERROR', { status })),
    );
    await expect(
      requestAnalysis(
        { mode: 'general', instruction: '' },
        [new File(['test'], 'site.png', { type: 'image/png' })],
        new AbortController().signal,
      ),
    ).rejects.toThrow(message);
  });
});
