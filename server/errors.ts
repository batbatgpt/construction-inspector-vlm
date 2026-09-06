export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function mapGeminiError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const value = error as {
    status?: number;
    message?: string;
    name?: string;
    cause?: { code?: string };
  } | null;
  const status = value?.status;
  const message = value?.message || '';
  if (
    status === 401 ||
    status === 403 ||
    /API_KEY_INVALID|API key not valid|invalid api key/i.test(message)
  ) {
    return new AppError(
      502,
      'GEMINI_AUTH',
      'Gemini could not authorize this request. Check GEMINI_API_KEY and its API restrictions on the server, then restart it.',
    );
  }
  if (status === 404 || /model.*(not found|not supported|unavailable)/i.test(message)) {
    return new AppError(
      502,
      'GEMINI_MODEL',
      'The configured Gemini model is unavailable or does not support this request. Check GEMINI_MODEL on the server.',
    );
  }
  if (status === 429)
    return new AppError(
      429,
      'GEMINI_QUOTA',
      'Gemini rate limit or quota reached. Wait before trying again, or check the quota for your selected model in Google AI Studio.',
    );
  if (
    value?.name === 'AbortError' ||
    value?.name === 'TimeoutError' ||
    status === 408 ||
    status === 504 ||
    /timed?\s*out|timeout/i.test(message)
  ) {
    return new AppError(
      504,
      'GEMINI_TIMEOUT',
      'Gemini took too long to respond. Try again with fewer photographs.',
    );
  }
  if (
    (status && status >= 500) ||
    /fetch failed|network|ECONN|ENOTFOUND/i.test(`${message} ${value?.cause?.code || ''}`)
  ) {
    return new AppError(
      503,
      'GEMINI_NETWORK',
      'Unable to reach Gemini right now. Check the server’s internet connection and try again shortly.',
    );
  }
  if (status === 400)
    return new AppError(
      502,
      'GEMINI_REQUEST',
      'Gemini could not process the request. Check that GEMINI_MODEL supports images and structured output, or try different photographs.',
    );
  return new AppError(502, 'GEMINI_FAILURE', 'Gemini could not complete the inspection. Please try again.');
}
