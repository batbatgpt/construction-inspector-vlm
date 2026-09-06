import { describe, expect, it } from 'vitest';
import { checkUploads } from '../client/src/lib/uploads.js';
import { reportAsText } from '../client/src/lib/report.js';
import { LIMITS } from '../shared/config.js';
import { reportFixture } from './fixtures.js';

describe('upload preflight and report export', () => {
  it('accepts supported images and rejects invalid selections atomically', () => {
    const png = new File(['test'], 'image.png', { type: 'image/png' });
    expect(checkUploads([], [png])).toBeNull();
    expect(checkUploads([], [new File(['test'], 'note.txt', { type: 'text/plain' })])).toContain('JPEG');
    expect(checkUploads(Array(6).fill(png), [png])).toContain('up to 6');
    expect(
      checkUploads(
        [],
        [new File([new Uint8Array(LIMITS.maxFileBytes + 1)], 'large.png', { type: 'image/png' })],
      ),
    ).toContain('3.5 MiB');
    const medium = new File([new Uint8Array(LIMITS.maxFileBytes)], 'medium.png', { type: 'image/png' });
    expect(checkUploads([medium, medium, medium], [medium])).toContain('3.5 MiB');
  });
  it('exports report context, evidence, all sections, and limitations without prompts', () => {
    const text = reportAsText(reportFixture);
    for (const heading of [
      'General Site Inspection',
      '2 photograph(s)',
      'Direct Observations',
      'Possible Interpretations',
      'Possible Concerns',
      'Cannot Determine',
      'Recommended Follow-Up',
      'High visual certainty',
      'Image 1',
      'not an engineering certification',
    ])
      expect(text).toContain(heading);
    expect(text).not.toContain('systemInstruction');
  });
});
