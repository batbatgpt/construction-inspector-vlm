import { LIMITS, UPLOAD_TOTAL_LABEL } from '../../../shared/config';
import { reportSchema, type InspectionInput, type InspectionReport } from '../../../shared/schema';
import { checkUploads } from './uploads';

export async function requestAnalysis(
  input: InspectionInput,
  files: File[],
  signal: AbortSignal,
): Promise<InspectionReport> {
  const issue = checkUploads([], files);
  if (issue) throw new Error(issue);
  const form = new FormData();
  form.append('mode', input.mode);
  form.append('instruction', input.instruction);
  // Bound multipart filename overhead independently of user-supplied filenames.
  for (const [index, file] of files.entries()) form.append('images', file, `image-${index + 1}`);
  let response: Response;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'X-Inspection-Request': '1' },
      body: form,
      signal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.clientTimeoutMs)]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError')
      throw new Error('The inspection timed out. Try again with fewer photographs.', { cause: error });
    throw new Error('Cannot reach the inspection server. Check that the backend is running and try again.', {
      cause: error,
    });
  }
  // Platform errors can arrive as plain text before the Express handler runs.
  if (response.status === 413)
    throw new Error(
      `The upload was too large. Keep photographs within ${UPLOAD_TOTAL_LABEL} combined and try again.`,
    );
  if (response.status === 504) throw new Error('The inspection timed out. Try again with fewer photographs.');
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('The server returned an unreadable response. Check that the backend is running.');
  }
  if (!response.ok) {
    const message = (body as { error?: { message?: unknown } })?.error?.message;
    throw new Error(
      typeof message === 'string' ? message : 'The inspection could not be completed. Please try again.',
    );
  }
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) throw new Error('The server returned an invalid inspection report. Please try again.');
  return parsed.data;
}
