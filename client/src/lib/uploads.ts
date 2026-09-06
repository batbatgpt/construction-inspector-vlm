import { ACCEPTED_MIME_TYPES, LIMITS, UPLOAD_FILE_LABEL, UPLOAD_TOTAL_LABEL } from '../../../shared/config';

export interface UploadedImage {
  id: string;
  file: File;
  url: string;
}

export function checkUploads(existing: File[], incoming: File[]): string | null {
  if (existing.length + incoming.length > LIMITS.maxImages)
    return `You can add up to ${LIMITS.maxImages} photographs. Remove an image or select fewer files.`;
  for (const file of incoming) {
    if (!ACCEPTED_MIME_TYPES.some((mime) => mime === file.type))
      return `${file.name}: choose a JPEG, PNG, or WebP image.`;
    if (file.size === 0 || file.size > LIMITS.maxFileBytes)
      return `${file.name}: the file is empty or exceeds the ${UPLOAD_FILE_LABEL} limit.`;
  }
  if ([...existing, ...incoming].reduce((total, file) => total + file.size, 0) > LIMITS.maxTotalBytes)
    return `The photographs exceed the ${UPLOAD_TOTAL_LABEL} combined limit. Remove or resize some images.`;
  return null;
}

export async function verifyBrowserImage(file: File): Promise<void> {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > LIMITS.maxPixels)
      throw new Error('This photograph exceeds the 20-megapixel limit. Resize it before adding.');
  } finally {
    bitmap.close();
  }
}
