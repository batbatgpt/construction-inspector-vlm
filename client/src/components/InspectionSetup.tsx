import { LIMITS } from '../../../shared/config';
import { PRESETS, type InspectionMode } from '../../../shared/presets';
import { Icon } from './Icon';

interface Props {
  mode: InspectionMode;
  instruction: string;
  disabled: boolean;
  loading: boolean;
  imageCount: number;
  onMode: (mode: InspectionMode) => void;
  onInstruction: (value: string) => void;
  onAnalyze: () => void;
  onCancel: () => void;
}
export function InspectionSetup({
  mode,
  instruction,
  disabled,
  loading,
  imageCount,
  onMode,
  onInstruction,
  onAnalyze,
  onCancel,
}: Props) {
  const custom = mode === 'custom';
  const canAnalyze = imageCount > 0 && (!custom || instruction.trim().length > 0) && !disabled;
  return (
    <section className="panel setup-panel" aria-labelledby="setup-heading">
      <div className="section-heading">
        <div>
          <span className="step">02</span>
          <h2 id="setup-heading">Inspection scope</h2>
        </div>
      </div>
      <fieldset disabled={disabled} className="preset-fieldset">
        <legend className="sr-only">Inspection category</legend>
        <div className="preset-grid">
          {PRESETS.map((preset, index) => (
            <label key={preset.id} className={`preset ${mode === preset.id ? 'selected' : ''}`}>
              <input
                type="radio"
                name="mode"
                value={preset.id}
                checked={mode === preset.id}
                onChange={() => onMode(preset.id)}
              />
              <span className="preset-index">{String(index + 1).padStart(2, '0')}</span>
              <span>{preset.shortLabel}</span>
              <span className="sr-only"> — {preset.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="preset-description">{PRESETS.find((preset) => preset.id === mode)!.description}</p>
      <label className="field-label" htmlFor="instruction">
        {custom ? 'Your inspection question' : 'Notes or a specific question'}{' '}
        <span>{custom ? 'Required' : 'Optional'}</span>
      </label>
      <textarea
        id="instruction"
        value={instruction}
        disabled={disabled}
        maxLength={LIMITS.maxInstructionChars}
        required={custom}
        rows={4}
        placeholder={
          custom
            ? 'What should be examined in these photographs?'
            : 'e.g. Focus on the access route in Image 2. These photographs show different work areas.'
        }
        onChange={(event) => onInstruction(event.target.value)}
        aria-describedby="instruction-count"
      />
      <div className="character-count" id="instruction-count">
        {instruction.length} / {LIMITS.maxInstructionChars}
      </div>
      <button
        type="button"
        className="button primary analyze-button"
        disabled={!canAnalyze}
        onClick={onAnalyze}
      >
        {loading ? (
          <>
            <span className="spinner" />
            Analyzing photographs…
          </>
        ) : (
          <>
            Analyze photographs
            <Icon name="arrow" />
          </>
        )}
      </button>
      {loading ? (
        <button type="button" className="text-button cancel-button" onClick={onCancel}>
          Cancel inspection
        </button>
      ) : (
        <p className="submit-help">
          {imageCount === 0
            ? 'Add a photograph to start your inspection.'
            : custom && !instruction.trim()
              ? 'Add your question to continue.'
              : 'Photographs are sent to Gemini only when you analyze.'}
        </p>
      )}
    </section>
  );
}
