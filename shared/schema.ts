import { z } from 'zod';
import { LIMITS } from './config.js';
import { PRESETS } from './presets.js';

const text = z.string().trim().min(1).max(3000);
const findingSchema = z.strictObject({
  category: z.string().trim().min(1).max(120),
  description: text,
  evidence: text,
  visualCertainty: z.enum(['high', 'moderate', 'uncertain']),
  imageRefs: z.array(z.number().int().min(1).max(LIMITS.maxImages)).max(LIMITS.maxImages),
});

export const inspectionResultSchema = z.strictObject({
  summary: text,
  observations: z.array(findingSchema).max(30),
  interpretations: z.array(findingSchema).max(30),
  possibleConcerns: z.array(findingSchema).max(30),
  cannotDetermine: z.array(z.strictObject({ item: text, reason: text })).max(30),
  recommendedFollowUp: z.array(z.strictObject({ action: text, reason: text })).max(30),
});

export const inspectionInputSchema = z
  .strictObject({
    mode: z.enum(PRESETS.map((preset) => preset.id)),
    instruction: z.string().trim().max(LIMITS.maxInstructionChars).default(''),
  })
  .superRefine((value, context) => {
    if (value.mode === 'custom' && !value.instruction) {
      context.addIssue({
        code: 'custom',
        path: ['instruction'],
        message: 'Add a question or instruction for Custom Analysis.',
      });
    }
  });

export type InspectionInput = z.infer<typeof inspectionInputSchema>;
export type InspectionResult = z.infer<typeof inspectionResultSchema>;
export type Finding = z.infer<typeof findingSchema>;

export const reportSchema = z.strictObject({
  result: inspectionResultSchema,
  metadata: z.strictObject({
    mode: z.enum(PRESETS.map((preset) => preset.id)),
    instruction: z.string().max(LIMITS.maxInstructionChars),
    analyzedAt: z.iso.datetime(),
    imageCount: z.number().int().min(1).max(LIMITS.maxImages),
    model: z.string().min(1),
  }),
});
export type InspectionReport = z.infer<typeof reportSchema>;
export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function validateResult(value: unknown, imageCount: number): InspectionResult {
  const result = inspectionResultSchema.parse(value);
  for (const finding of [...result.observations, ...result.interpretations, ...result.possibleConcerns]) {
    if (
      finding.imageRefs.some((ref) => ref > imageCount) ||
      new Set(finding.imageRefs).size !== finding.imageRefs.length
    ) {
      throw new Error('Invalid image references in model output.');
    }
  }
  return result;
}
