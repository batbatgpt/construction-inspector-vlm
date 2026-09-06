import { useState } from 'react';
import { CERTAINTY_LABELS, REPORT_NOTICE } from '../../../shared/config';
import { getPreset } from '../../../shared/presets';
import type { Finding, InspectionReport } from '../../../shared/schema';
import type { UploadedImage } from '../lib/uploads';
import { downloadReport, reportAsText } from '../lib/report';
import { Icon } from './Icon';

function FindingsSection({
  title,
  subtitle,
  findings,
  tone,
  onPreview,
}: {
  title: string;
  subtitle: string;
  findings: Finding[];
  tone: string;
  onPreview: (index: number) => void;
}) {
  return (
    <section className={`result-section ${tone}`}>
      <div className="result-section-heading">
        <h3>{title}</h3>
        <span>{findings.length}</span>
      </div>
      <p className="result-section-subtitle">{subtitle}</p>
      {findings.length ? (
        findings.map((finding, index) => (
          <article className="finding" key={index}>
            <div className="finding-heading">
              <h4>{finding.category}</h4>
              <span className={`certainty ${finding.visualCertainty}`}>
                {CERTAINTY_LABELS[finding.visualCertainty]}
              </span>
            </div>
            <p>{finding.description}</p>
            <div className="evidence">
              <strong>Visible evidence</strong>
              <p>{finding.evidence}</p>
            </div>
            {!!finding.imageRefs.length && (
              <div className="image-refs">
                {finding.imageRefs.map((ref) => (
                  <button key={ref} type="button" onClick={() => onPreview(ref - 1)}>
                    <Icon name="image" size={13} />
                    Image {ref}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))
      ) : (
        <p className="empty-section">
          No findings returned in this section. This does not confirm the absence of issues.
        </p>
      )}
    </section>
  );
}

export function Report({
  report,
  images,
  onPreview,
}: {
  report: InspectionReport;
  images: UploadedImage[];
  onPreview: (index: number) => void;
}) {
  const [copyMessage, setCopyMessage] = useState('');
  const { result, metadata } = report;
  async function copy() {
    try {
      await navigator.clipboard.writeText(reportAsText(report));
      setCopyMessage('Report copied.');
    } catch {
      setCopyMessage('Clipboard unavailable. Use Export JSON or Print report instead.');
    }
  }
  return (
    <div className="report" id="inspection-report">
      <div className="report-title-row">
        <div>
          <span className="eyebrow">INSPECTION REPORT</span>
          <h2>Evidence & findings</h2>
        </div>
        <span className="report-ready">
          <Icon name="check" size={15} />
          Analysis complete
        </span>
      </div>
      <div className="report-toolbar no-print">
        <button type="button" className="button secondary small" onClick={() => downloadReport(report)}>
          Export JSON
        </button>
        <button type="button" className="button secondary small" onClick={() => window.print()}>
          Print report
        </button>
        <button type="button" className="button secondary small" onClick={copy}>
          Copy report text
        </button>
      </div>
      {copyMessage && (
        <p className="copy-status no-print" role="status">
          {copyMessage}
        </p>
      )}
      <div className="report-meta">
        <strong>{getPreset(metadata.mode)!.label}</strong>
        <span>{new Date(metadata.analyzedAt).toLocaleString()}</span>
        <span>
          {metadata.imageCount} photograph{metadata.imageCount === 1 ? '' : 's'}
        </span>
        <span>Model: {metadata.model}</span>
      </div>
      {metadata.instruction && (
        <div className="report-question">
          <strong>Inspection notes / question</strong>
          <p>{metadata.instruction}</p>
        </div>
      )}
      <div className="reference-strip no-print" aria-label="Report photographs">
        {images.map((image, index) => (
          <button
            type="button"
            key={image.id}
            onClick={() => onPreview(index)}
            aria-label={`Open report Image ${index + 1}`}
          >
            <img src={image.url} alt={`Reference photograph ${index + 1}`} />
            <span>
              Image {index + 1}
              <Icon name="expand" size={12} />
            </span>
          </button>
        ))}
      </div>
      <section className="summary-card">
        <span className="eyebrow">OVERALL SUMMARY</span>
        <p>{result.summary}</p>
      </section>
      <nav className="report-jump no-print" aria-label="Report sections">
        <a href="#observations">Observations</a>
        <a href="#interpretations">Interpretations</a>
        <a href="#concerns">Concerns</a>
        <a href="#unknowns">Cannot determine</a>
        <a href="#follow-up">Follow-up</a>
      </nav>
      <div id="observations">
        <FindingsSection
          title="Direct Observations"
          subtitle="What is directly supported by the photographs."
          findings={result.observations}
          tone="observations"
          onPreview={onPreview}
        />
      </div>
      <div id="interpretations">
        <FindingsSection
          title="Possible Interpretations"
          subtitle="Plausible explanations that may need confirmation."
          findings={result.interpretations}
          tone="interpretations"
          onPreview={onPreview}
        />
      </div>
      <div id="concerns">
        <FindingsSection
          title="Possible Concerns"
          subtitle="Conditions that may warrant a closer inspection."
          findings={result.possibleConcerns}
          tone="concerns"
          onPreview={onPreview}
        />
      </div>
      <section className="result-section unknowns" id="unknowns">
        <div className="result-section-heading">
          <h3>Cannot Determine</h3>
          <span>{result.cannotDetermine.length}</span>
        </div>
        <p className="result-section-subtitle">Where the photographs do not provide enough evidence.</p>
        {result.cannotDetermine.length ? (
          result.cannotDetermine.map((item, index) => (
            <article className="finding" key={index}>
              <h4>{item.item}</h4>
              <p>{item.reason}</p>
            </article>
          ))
        ) : (
          <p className="empty-section">
            No limitations returned in this section. Photographs still provide only a partial view.
          </p>
        )}
      </section>
      <section className="result-section follow-up" id="follow-up">
        <div className="result-section-heading">
          <h3>Recommended Follow-Up</h3>
          <span>{result.recommendedFollowUp.length}</span>
        </div>
        <p className="result-section-subtitle">Practical next steps to verify or clarify the findings.</p>
        {result.recommendedFollowUp.length ? (
          <ol className="follow-up-list">
            {result.recommendedFollowUp.map((item, index) => (
              <li key={index}>
                <h4>{item.action}</h4>
                <p>{item.reason}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-section">No follow-up actions returned.</p>
        )}
      </section>
      <p className="report-notice">{REPORT_NOTICE}</p>
    </div>
  );
}
