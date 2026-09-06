import { useEffect, useRef } from 'react';
import type { UploadedImage } from '../lib/uploads';
import { Icon } from './Icon';

export function ImageViewer({
  images,
  index,
  onClose,
  onSelect,
}: {
  images: UploadedImage[];
  index: number | null;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = index === null ? undefined : images[index];
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected && dialog.current?.open) dialog.current.close();
  }, [selected]);
  return (
    <dialog
      ref={dialog}
      className="image-dialog"
      onCancel={onClose}
      onClose={onClose}
      aria-label="Photograph viewer"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {selected && (
        <div className="viewer-content">
          <div className="viewer-heading">
            <div>
              <strong>Image {index! + 1}</strong>
              <span>{selected.file.name}</span>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={onClose}
              aria-label="Close photograph viewer"
              autoFocus
            >
              <Icon name="close" />
            </button>
          </div>
          <img className="full-image" src={selected.url} alt={`Image ${index! + 1}: ${selected.file.name}`} />
          {images.length > 1 && (
            <nav className="viewer-nav" aria-label="Select photograph">
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  className={`button small ${index === i ? 'primary' : 'secondary'}`}
                  onClick={() => onSelect(i)}
                  aria-current={index === i ? 'true' : undefined}
                >
                  Image {i + 1}
                </button>
              ))}
            </nav>
          )}
        </div>
      )}
    </dialog>
  );
}
