import { Icon } from './Icon';

export function EmptyReport({ loading }: { loading: boolean }) {
  return (
    <section
      className={`empty-report ${loading ? 'is-loading' : ''}`}
      aria-labelledby="results-heading"
      aria-busy={loading}
    >
      <div className="empty-report-top">
        <span className="eyebrow">INSPECTION WORKSPACE</span>
        <span className="draft-label">{loading ? 'In progress' : 'Ready when you are'}</span>
      </div>
      <div className="empty-report-main">
        <div className="report-illustration">
          <div className="illustration-grid" />
          <div className="illustration-sheet">
            <Icon name="building" size={54} />
            <span />
            <span />
            <span />
          </div>
          <span className="illustration-badge">
            <Icon name="document" size={21} />
          </span>
        </div>
        <h2 id="results-heading">
          {loading ? 'Examining the visible evidence' : 'A clearer view of site conditions.'}
        </h2>
        <p>
          {loading
            ? 'Gemini is reviewing your photographs and preparing a structured inspection report. This may take up to two minutes.'
            : 'Turn construction photographs into an organized inspection report, with evidence and uncertainty kept in view.'}
        </p>
        {loading && (
          <div className="loading-indicator" role="status">
            <span className="spinner" />
            Analysis in progress…
          </div>
        )}
      </div>
      <div className="evidence-principles">
        <div>
          <span className="principle-mark direct" />
          <h3>Observe</h3>
          <p>Visible facts, linked to their photographic evidence.</p>
        </div>
        <div>
          <span className="principle-mark interpret" />
          <h3>Interpret</h3>
          <p>Possible explanations, with uncertainty made explicit.</p>
        </div>
        <div>
          <span className="principle-mark verify" />
          <h3>Follow up</h3>
          <p>Useful next steps where a photograph is not enough.</p>
        </div>
      </div>
      <div className="empty-report-footer">
        <Icon name="document" size={16} />
        <span>Your report will appear here. Export, copy, or print it after analysis.</span>
      </div>
    </section>
  );
}
