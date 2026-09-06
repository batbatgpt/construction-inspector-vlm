import type { InspectionReport, InspectionResult } from '../shared/schema.js';

// Synthetic data used only in automated tests. Never imported by application code.
export const resultFixture: InspectionResult = {
  summary: 'Test fixture: a partial view of a work area; further inspection is needed.',
  observations: [
    {
      category: 'Visible barrier',
      description: 'A barrier is visible along the edge of the pictured area.',
      evidence: 'Uprights and a horizontal rail are visible in Image 1.',
      visualCertainty: 'high',
      imageRefs: [1],
    },
  ],
  interpretations: [
    {
      category: 'Possible access boundary',
      description: 'The barrier may mark an access boundary.',
      evidence: 'Its position across the foreground suggests a boundary; its intended use is unknown.',
      visualCertainty: 'moderate',
      imageRefs: [1],
    },
  ],
  possibleConcerns: [
    {
      category: 'Obscured edge',
      description: 'The edge behind the barrier is obscured and needs a closer view.',
      evidence: 'The lower part of the area is outside the frame.',
      visualCertainty: 'uncertain',
      imageRefs: [1],
    },
  ],
  cannotDetermine: [
    {
      item: 'Barrier adequacy',
      reason: 'Dimensions, fixings, and task requirements cannot be determined visually.',
    },
  ],
  recommendedFollowUp: [
    {
      action: 'Inspect barrier fixings on site.',
      reason: 'A closer inspection can establish their condition and configuration.',
    },
  ],
};
export const reportFixture: InspectionReport = {
  result: resultFixture,
  metadata: {
    mode: 'general',
    instruction: '',
    imageCount: 2,
    analyzedAt: '2026-09-06T12:00:00.000Z',
    model: 'test-model',
  },
};
