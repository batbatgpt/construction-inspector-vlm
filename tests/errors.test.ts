import { describe, expect, it } from 'vitest';
import { AppError, mapGeminiError } from '../server/errors.js';

describe('safe Gemini error mapping', () => {
  it.each([
    [{ status: 401 }, 'GEMINI_AUTH'],
    [{ status: 403 }, 'GEMINI_AUTH'],
    [{ status: 400, message: 'API key not valid. secret-test-value' }, 'GEMINI_AUTH'],
    [{ status: 404 }, 'GEMINI_MODEL'],
    [{ status: 429 }, 'GEMINI_QUOTA'],
    [{ status: 503 }, 'GEMINI_NETWORK'],
    [{ message: 'fetch failed' }, 'GEMINI_NETWORK'],
    [{ name: 'AbortError' }, 'GEMINI_TIMEOUT'],
    [{ status: 504 }, 'GEMINI_TIMEOUT'],
    [{ status: 400 }, 'GEMINI_REQUEST'],
    [null, 'GEMINI_FAILURE'],
  ])('maps %j to %s', (error, code) => {
    const mapped = mapGeminiError(error);
    expect(mapped.code).toBe(code);
    expect(mapped.message).not.toContain('secret-test-value');
  });
  it('preserves already sanitized errors', () => {
    const error = new AppError(502, 'INVALID_MODEL_OUTPUT', 'Invalid output');
    expect(mapGeminiError(error)).toBe(error);
  });
});
