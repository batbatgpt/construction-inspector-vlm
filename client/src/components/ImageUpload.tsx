import { useRef, useState } from 'react';
import { FILE_ACCEPT, LIMITS, UPLOAD_TOTAL_LABEL } from '../../../shared/config';
import type { UploadedImage } from '../lib/uploads';
import { Icon } from './Icon';

interface Props {
  images: UploadedImage[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPreview: (index: number) => void;
}
export function ImageUpload({ images, disabled, onAdd, onRemove, onClear, onPreview }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <section className="panel upload-panel" aria-labelledby="photographs-heading">
      <div className="section-heading">
        <div>
          <span className="step">01</span>
          <h2 id="photographs-heading">Photographs</h2>
        </div>
        <span className="count">
          {images.length} / {LIMITS.maxImages}
        </span>
      </div>
      <div
        className={`dropzone ${dragging && !disabled ? 'dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) onAdd(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="upload-symbol">
          <Icon name="upload" size={25} />
        </span>
        <strong>Bring the site into view</strong>
        <p>Drop your photographs here, or</p>
        <button
          type="button"
          className="button secondary small"
          disabled={disabled || images.length >= LIMITS.maxImages}
          onClick={() => input.current?.click()}
        >
          Browse photographs
        </button>
        <input
          ref={input}
          id="photograph-input"
          type="file"
          aria-label="Upload construction photographs"
          accept={FILE_ACCEPT}
          multiple
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            onAdd(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
        <span className="upload-limits">JPEG, PNG, WebP · {UPLOAD_TOTAL_LABEL} total</span>
      </div>
      {images.length > 0 && (
        <>
          <div className="image-grid">
            {images.map((image, index) => (
              <div className="image-tile" key={image.id}>
                <button
                  type="button"
                  className="thumbnail"
                  onClick={() => onPreview(index)}
                  aria-label={`View Image ${index + 1}: ${image.file.name}`}
                >
                  <img src={image.url} alt={`Image ${index + 1}: ${image.file.name}`} />
                  <span className="image-number">Image {index + 1}</span>
                </button>
                <button
                  type="button"
                  className="remove-image"
                  disabled={disabled}
                  onClick={() => onRemove(image.id)}
                  aria-label={`Remove Image ${index + 1}`}
                >
                  <Icon name="close" size={14} />
                </button>
                <span className="image-filename" title={image.file.name}>
                  {image.file.name}
                </span>
              </div>
            ))}
          </div>
          <div className="image-footer">
            <span>
              {images.length} photograph{images.length === 1 ? '' : 's'} added
            </span>
            <button type="button" className="text-button" disabled={disabled} onClick={onClear}>
              Clear all
            </button>
          </div>
        </>
      )}
      <p className="section-note">
        Add wide views and useful close-ups. Explain any relationship between photographs in your inspection
        notes.
      </p>
    </section>
  );
}
