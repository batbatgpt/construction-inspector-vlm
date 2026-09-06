import { CERTAINTY_LABELS, REPORT_NOTICE } from '../../../shared/config';
import { getPreset } from '../../../shared/presets';
import type { InspectionReport } from '../../../shared/schema';

export function reportAsText(report: InspectionReport): string {
  const { metadata, result } = report;
  const lines = [
    'Construction Inspector VLM — Inspection report',
    getPreset(metadata.mode)!.label,
    new Date(metadata.analyzedAt).toLocaleString(),
    `${metadata.imageCount} photograph(s)`,
    `Model: ${metadata.model}`,
    ...(metadata.instruction ? [`Inspection question: ${metadata.instruction}`] : []),
    '',
    'Summary',
    result.summary,
  ];
  for (const [heading, findings] of [
    ['Direct Observations', result.observations],
    ['Possible Interpretations', result.interpretations],
    ['Possible Concerns', result.possibleConcerns],
  ] as const) {
    lines.push('', heading);
    if (!findings.length) lines.push('No findings returned in this section.');
    for (const finding of findings)
      lines.push(
        `- ${finding.category}: ${finding.description}`,
        `  Evidence: ${finding.evidence}`,
        `  ${CERTAINTY_LABELS[finding.visualCertainty]}${finding.imageRefs.length ? ` · ${finding.imageRefs.map((ref) => `Image ${ref}`).join(', ')}` : ''}`,
      );
  }
  lines.push('', 'Cannot Determine');
  if (!result.cannotDetermine.length) lines.push('No items returned in this section.');
  for (const item of result.cannotDetermine) lines.push(`- ${item.item}: ${item.reason}`);
  lines.push('', 'Recommended Follow-Up');
  if (!result.recommendedFollowUp.length) lines.push('No actions returned in this section.');
  for (const item of result.recommendedFollowUp) lines.push(`- ${item.action}: ${item.reason}`);
  return [...lines, '', REPORT_NOTICE].join('\n');
}

export function downloadReport(report: InspectionReport) {
  const blob = new Blob(
    [JSON.stringify({ title: 'Construction Inspector VLM', ...report, notice: REPORT_NOTICE }, null, 2)],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `construction-inspection-${report.metadata.analyzedAt.replace(/[:.]/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
