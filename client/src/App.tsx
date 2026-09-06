import { useEffect, useRef, useState } from 'react';
import type { InspectionMode } from '../../shared/presets';
import { inspectionInputSchema, type InspectionReport } from '../../shared/schema';
import { ImageUpload } from './components/ImageUpload';
import { InspectionSetup } from './components/InspectionSetup';
import { Report } from './components/Report';
import { EmptyReport } from './components/EmptyReport';
import { ImageViewer } from './components/ImageViewer';
import { Icon } from './components/Icon';
import { checkUploads, verifyBrowserImage, type UploadedImage } from './lib/uploads';
import { requestAnalysis } from './lib/api';

export function App() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [mode, setMode] = useState<InspectionMode>('general');
  const [instruction, setInstruction] = useState('');
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewer, setViewer] = useState<number | null>(null);
  const [health, setHealth] = useState<'checking' | 'configured' | 'missing' | 'offline'>('checking');
  const abortRef = useRef<AbortController | null>(null);
  const imagesRef = useRef<UploadedImage[]>([]);
  const addingRef = useRef(false);
  const generationRef = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/health', { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable');
        const data = (await response.json()) as { configured: boolean };
        setHealth(data.configured ? 'configured' : 'missing');
      })
      .catch(() => {
        if (!abort.signal.aborted) setHealth('offline');
      });
    return () => {
      abort.abort();
      abortRef.current?.abort();
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, []);

  function replaceImages(next: UploadedImage[]) {
    imagesRef.current = next;
    setImages(next);
  }
  function invalidateReport() {
    if (report) setNotice('Inspection inputs changed. Analyze again to create an updated report.');
    setReport(null);
    setError('');
  }
  async function addImages(files: File[]) {
    if (addingRef.current || abortRef.current || !files.length) return;
    const issue = checkUploads(
      imagesRef.current.map((image) => image.file),
      files,
    );
    if (issue) {
      setError(issue);
      return;
    }
    addingRef.current = true;
    setAdding(true);
    setError('');
    const generation = generationRef.current;
    try {
      for (const file of files) await verifyBrowserImage(file);
      if (generation !== generationRef.current) return;
      const added = files.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
      invalidateReport();
      replaceImages([...imagesRef.current, ...added]);
    } catch (error) {
      if (generation === generationRef.current)
        setError(
          error instanceof Error && error.message.includes('megapixel')
            ? error.message
            : 'One of the selected files could not be read as a photograph. Re-export it as JPEG, PNG, or WebP. No files from this selection were added.',
        );
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }
  function removeImage(id: string) {
    const image = images.find((item) => item.id === id);
    if (image) URL.revokeObjectURL(image.url);
    invalidateReport();
    replaceImages(images.filter((item) => item.id !== id));
    setViewer(null);
  }
  function clearImages() {
    images.forEach((image) => URL.revokeObjectURL(image.url));
    replaceImages([]);
    invalidateReport();
    setViewer(null);
  }
  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setNotice('Inspection cancelled. Your photographs and setup are retained.');
  }
  function reset() {
    generationRef.current++;
    cancel();
    clearImages();
    setMode('general');
    setInstruction('');
    setNotice('');
    setError('');
  }
  async function analyze() {
    if (abortRef.current || addingRef.current) return;
    if (!images.length) {
      setError('Add at least one photograph before analyzing.');
      return;
    }
    const input = inspectionInputSchema.safeParse({ mode, instruction });
    if (!input.success) {
      setError(input.error.issues[0].message);
      return;
    }
    const abort = new AbortController();
    abortRef.current = abort;
    setLoading(true);
    setReport(null);
    setError('');
    setNotice('');
    try {
      const result = await requestAnalysis(
        input.data,
        images.map((image) => image.file),
        abort.signal,
      );
      if (!abort.signal.aborted) {
        setReport(result);
        setHealth('configured');
        requestAnimationFrame(() => resultRef.current?.focus());
      }
    } catch (error) {
      if (!abort.signal.aborted)
        setError(error instanceof Error ? error.message : 'The inspection could not be completed.');
    } finally {
      if (abortRef.current === abort) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <>
      <a className="skip-link" href="#inspection-main">
        Skip to inspection
      </a>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon">
              <Icon name="building" size={27} />
            </span>
            <div>
              <h1>
                Construction Inspector <span>VLM</span>
              </h1>
              <p>Evidence-led visual inspection</p>
            </div>
          </div>
          <div className="header-actions">
            <span className="local-label">
              <span />
              Local workspace
            </span>
            <button
              type="button"
              className="button secondary small"
              onClick={reset}
              disabled={adding}
              aria-label="New inspection"
            >
              <Icon name="reset" size={15} />
              <span>New inspection</span>
            </button>
          </div>
        </div>
      </header>
      <main id="inspection-main" className="page-shell">
        <div className="page-intro">
          <div>
            <span className="eyebrow">FROM PHOTOGRAPH TO FINDING</span>
            <h2>
              Inspect what you can see.
              <br className="mobile-break" /> Understand what you can’t.
            </h2>
            <p>A focused review of construction photographs, grounded in visible evidence.</p>
          </div>
          <span className="session-badge">
            SESSION ONLY<span>Nothing saved to a database</span>
          </span>
        </div>
        {health === 'missing' && (
          <aside className="configuration-note no-print">
            <span className="status-dot" />
            <p>
              <strong>Gemini setup needed.</strong> Add your API key to the server’s local <code>.env</code>{' '}
              file and restart. You can prepare your inspection now.
            </p>
          </aside>
        )}
        {health === 'offline' && (
          <aside className="configuration-note no-print">
            <p>
              <strong>Inspection server unavailable.</strong> Start the backend with <code>npm run dev</code>{' '}
              and reload this page.
            </p>
          </aside>
        )}
        <div className="workspace">
          <aside className="setup-column no-print">
            <ImageUpload
              images={images}
              disabled={loading || adding}
              onAdd={addImages}
              onRemove={removeImage}
              onClear={clearImages}
              onPreview={setViewer}
            />
            <InspectionSetup
              mode={mode}
              instruction={instruction}
              disabled={loading || adding}
              loading={loading}
              imageCount={images.length}
              onMode={(value) => {
                invalidateReport();
                setMode(value);
              }}
              onInstruction={(value) => {
                invalidateReport();
                setInstruction(value);
              }}
              onAnalyze={analyze}
              onCancel={cancel}
            />
            <div className="status-area">
              {adding && <p role="status">Checking photographs…</p>}
              {error && (
                <div className="error-message" role="alert">
                  <strong>Inspection needs attention</strong>
                  <p>{error}</p>
                  <button type="button" className="text-button" onClick={() => setError('')}>
                    Dismiss
                  </button>
                </div>
              )}
              {notice && (
                <p className="notice" role="status">
                  {notice}
                </p>
              )}
            </div>
          </aside>
          <div className="results-column" ref={resultRef} tabIndex={-1} aria-label="Inspection results">
            {report ? (
              <Report
                key={report.metadata.analyzedAt}
                report={report}
                images={images}
                onPreview={setViewer}
              />
            ) : (
              <EmptyReport loading={loading} />
            )}
          </div>
        </div>
        <footer className="app-footer">
          <span>Construction Inspector VLM</span>
          <p>
            Visual interpretation supports professional judgment. It does not establish engineering adequacy
            or regulatory compliance.
          </p>
        </footer>
      </main>
      <ImageViewer images={images} index={viewer} onClose={() => setViewer(null)} onSelect={setViewer} />
    </>
  );
}
