import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';
import { z } from 'zod';
import { LIMITS } from '../shared/config.js';
import {
  inspectionResultSchema,
  validateResult,
  type InspectionInput,
  type InspectionResult,
} from '../shared/schema.js';
import { getConfig } from './config.js';
import { AppError, mapGeminiError } from './errors.js';
import type { PreparedImage } from './images.js';
import { buildTaskInstruction, GROUNDING_INSTRUCTION } from './prompts.js';

// Gemini supports a JSON Schema subset; string length bounds remain enforced by Zod.
const responseJsonSchema = z.toJSONSchema(inspectionResultSchema, {
  override: ({ jsonSchema }) => {
    delete jsonSchema.minLength;
    delete jsonSchema.maxLength;
  },
});
delete responseJsonSchema.$schema;

export function buildGeminiRequest(
  input: InspectionInput,
  images: PreparedImage[],
  model: string,
  signal?: AbortSignal,
): GenerateContentParameters {
  return {
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildTaskInstruction(input, images.length) },
          ...images.flatMap((image, index) => [{ text: `Image ${index + 1}:` }, { inlineData: image }]),
        ],
      },
    ],
    config: {
      systemInstruction: GROUNDING_INSTRUCTION,
      responseMimeType: 'application/json',
      responseJsonSchema,
      maxOutputTokens: 16384,
      httpOptions: { timeout: LIMITS.modelTimeoutMs, retryOptions: { attempts: 1 } },
      abortSignal: signal,
    },
  };
}

export function parseGeminiResult(text: string | undefined, imageCount: number): InspectionResult {
  try {
    if (!text) throw new Error('Empty output');
    return validateResult(JSON.parse(text), imageCount);
  } catch {
    throw new AppError(
      502,
      'INVALID_MODEL_OUTPUT',
      'Gemini returned an incomplete or invalid inspection report. No findings were accepted. Please try again.',
    );
  }
}

export async function analyzeWithGemini(
  input: InspectionInput,
  images: PreparedImage[],
  signal: AbortSignal,
) {
  const { apiKey, model } = getConfig();
  if (!apiKey)
    throw new AppError(
      503,
      'MISSING_API_KEY',
      'Gemini is not configured. Add GEMINI_API_KEY to the server’s local .env file and restart the app. Never enter the key in the browser.',
    );
  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent(buildGeminiRequest(input, images, model, signal));
    const candidate = response.candidates?.[0];
    if (
      response.promptFeedback?.blockReason ||
      (candidate?.finishReason && candidate.finishReason !== 'STOP')
    ) {
      throw new AppError(
        502,
        'INCOMPLETE_MODEL_OUTPUT',
        'Gemini did not complete the inspection, or declined the supplied content. Try a narrower question or different photographs.',
      );
    }
    return { result: parseGeminiResult(response.text, images.length), model };
  } catch (error) {
    throw mapGeminiError(error);
  }
}
