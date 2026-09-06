import 'dotenv/config';

export const DEFAULT_MODEL = 'gemini-3.6-flash';
export function getConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim() || '',
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
  };
}
