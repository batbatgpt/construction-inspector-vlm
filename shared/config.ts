export const LIMITS = {
  maxImages: 6,
  maxFileBytes: 3.5 * 1024 * 1024,
  maxTotalBytes: 3.5 * 1024 * 1024,
  maxRequestBytes: 4_000_000,
  maxPreparedBytes: 12 * 1024 * 1024,
  maxPixels: 20_000_000,
  maxImageEdge: 2048,
  maxInstructionChars: 2000,
  modelTimeoutMs: 120_000,
  clientTimeoutMs: 150_000,
  maxConcurrentRequests: 2,
} as const;

export const UPLOAD_TOTAL_LABEL = `${LIMITS.maxTotalBytes / (1024 * 1024)} MiB`;
export const UPLOAD_FILE_LABEL = `${LIMITS.maxFileBytes / (1024 * 1024)} MiB`;

export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const FILE_ACCEPT = ACCEPTED_MIME_TYPES.join(',');
export const REPORT_NOTICE =
  'AI-assisted visual interpretation. This report is not an engineering certification, regulatory determination, or measurement. Confirm findings with a qualified person and appropriate site evidence.';

export const CERTAINTY_LABELS = {
  high: 'High visual certainty',
  moderate: 'Moderate visual certainty',
  uncertain: 'Uncertain',
} as const;
