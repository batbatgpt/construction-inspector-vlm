import sharp from 'sharp';
import { ACCEPTED_MIME_TYPES, LIMITS, UPLOAD_FILE_LABEL, UPLOAD_TOTAL_LABEL } from '../shared/config.js';
import { AppError } from './errors.js';

export interface PreparedImage {
  data: string;
  mimeType: 'image/jpeg';
}

export async function prepareImages(files: Express.Multer.File[]): Promise<PreparedImage[]> {
  if (!files.length)
    throw new AppError(400, 'NO_IMAGES', 'Add at least one construction photograph before analyzing.');
  if (files.length > LIMITS.maxImages)
    throw new AppError(
      400,
      'TOO_MANY_IMAGES',
      `Use no more than ${LIMITS.maxImages} photographs per inspection.`,
    );
  if (files.reduce((total, file) => total + file.buffer.length, 0) > LIMITS.maxTotalBytes) {
    throw new AppError(
      413,
      'TOTAL_TOO_LARGE',
      `The photographs exceed the ${UPLOAD_TOTAL_LABEL} combined limit. Remove or resize some images.`,
    );
  }
  const prepared: PreparedImage[] = [];
  let preparedBytes = 0;
  for (const [index, file] of files.entries()) {
    const label = `Image ${index + 1}`;
    if (!file.buffer.length || file.buffer.length > LIMITS.maxFileBytes)
      throw new AppError(
        413,
        'FILE_TOO_LARGE',
        `${label} is empty or exceeds the ${UPLOAD_FILE_LABEL} file limit.`,
      );
    if (!ACCEPTED_MIME_TYPES.some((mime) => mime === file.mimetype))
      throw new AppError(400, 'UNSUPPORTED_TYPE', `${label}: use a JPEG, PNG, or WebP photograph.`);
    try {
      const decoder = sharp(file.buffer, { limitInputPixels: LIMITS.maxPixels, failOn: 'warning' });
      const metadata = await decoder.metadata();
      const detectedMime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[
        metadata.format as string
      ];
      if (!detectedMime || detectedMime !== file.mimetype)
        throw new AppError(
          400,
          'INVALID_IMAGE',
          `${label}: the image contents do not match the declared file type. Re-export it as JPEG, PNG, or WebP.`,
        );
      if ((metadata.pages || 1) > 1)
        throw new AppError(
          400,
          'ANIMATED_IMAGE',
          `${label}: animated or multi-page images are not supported. Upload a still photograph.`,
        );
      const buffer = await decoder
        .rotate()
        .resize({
          width: LIMITS.maxImageEdge,
          height: LIMITS.maxImageEdge,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 90 })
        .toBuffer();
      preparedBytes += buffer.length;
      if (preparedBytes > LIMITS.maxPreparedBytes)
        throw new AppError(
          413,
          'PREPARED_TOO_LARGE',
          'The normalized photographs exceed the request limit. Try fewer or smaller photographs.',
        );
      prepared.push({ data: buffer.toString('base64'), mimeType: 'image/jpeg' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        400,
        'INVALID_IMAGE',
        `${label} cannot be decoded or exceeds the 20-megapixel limit. Re-export a smaller JPEG, PNG, or WebP image.`,
      );
    }
  }
  return prepared;
}
