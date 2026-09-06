import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';
import helmet from 'helmet';
import path from 'node:path';
import { LIMITS, ACCEPTED_MIME_TYPES } from '../shared/config.js';
import { inspectionInputSchema, validateResult } from '../shared/schema.js';
import { analyzeWithGemini } from './gemini.js';
import { getConfig } from './config.js';
import { prepareImages } from './images.js';
import { AppError } from './errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: LIMITS.maxFileBytes,
    files: LIMITS.maxImages,
    fields: 2,
    // Busboy raises partsLimit as soon as it reaches the limit; file/field counts enforce the exact cap.
    parts: LIMITS.maxImages + 3,
    fieldSize: LIMITS.maxInstructionChars * 4,
  },
  fileFilter: (_req, file, next) => {
    if (!ACCEPTED_MIME_TYPES.some((mime) => mime === file.mimetype))
      return next(new AppError(400, 'UNSUPPORTED_TYPE', 'Upload JPEG, PNG, or WebP photographs only.'));
    next(null, true);
  },
}).array('images', LIMITS.maxImages);

export function createApp(options: { analyzer?: typeof analyzeWithGemini; serveClient?: boolean } = {}) {
  const app = express();
  const analyzer = options.analyzer || analyzeWithGemini;
  let activeRequests = 0;
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", 'blob:', 'data:'],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (_req, res) => {
    const { apiKey, model } = getConfig();
    res.json({ status: 'ok', configured: Boolean(apiKey), model });
  });
  app.post(
    '/api/analyze',
    (req, res, next) => {
      // A custom header plus no CORS permission prevents cross-origin form requests.
      if (req.get('X-Inspection-Request') !== '1')
        return next(
          new AppError(
            403,
            'INVALID_ORIGIN',
            'This request must be submitted from the inspection application.',
          ),
        );
      if (!req.is('multipart/form-data'))
        return next(new AppError(415, 'INVALID_REQUEST', 'Send photographs with the inspection form.'));
      if (activeRequests >= LIMITS.maxConcurrentRequests)
        return next(
          new AppError(
            429,
            'SERVER_BUSY',
            'The server is processing other inspections. Please try again shortly.',
          ),
        );
      activeRequests++;
      let released = false;
      const release = () => {
        if (!released) {
          activeRequests--;
          released = true;
        }
      };
      res.once('close', release);
      next();
    },
    upload,
    async (req, res, next) => {
      const abort = new AbortController();
      const onClose = () => abort.abort();
      res.once('close', onClose);
      const timer = setTimeout(() => abort.abort(), LIMITS.modelTimeoutMs);
      try {
        const input = inspectionInputSchema.safeParse(req.body);
        if (!input.success)
          throw new AppError(
            400,
            'INVALID_INPUT',
            input.error.issues[0]?.message || 'Select an inspection mode and check your instruction.',
          );
        const images = await prepareImages((req.files || []) as Express.Multer.File[]);
        if (res.destroyed) return;
        const { result, model } = await analyzer(input.data, images, abort.signal);
        const checked = validateResult(result, images.length);
        if (!res.destroyed)
          res.json({
            result: checked,
            metadata: {
              ...input.data,
              analyzedAt: new Date().toISOString(),
              imageCount: images.length,
              model,
            },
          });
      } catch (error) {
        if (!res.destroyed) next(error);
      } finally {
        clearTimeout(timer);
        res.off('close', onClose);
      }
    },
  );
  app.use('/api', (_req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'This API endpoint does not exist.')),
  );
  if (options.serveClient) {
    const clientPath = path.resolve('dist/client');
    app.use(express.static(clientPath));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(clientPath, 'index.html')));
  }
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    let safe =
      error instanceof AppError
        ? error
        : new AppError(500, 'SERVER_ERROR', 'An unexpected server error occurred. Please try again.');
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      const tooMany = ['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_PART_COUNT'].includes(error.code);
      safe = new AppError(
        tooLarge ? 413 : 400,
        error.code,
        tooLarge
          ? 'A photograph exceeds the 4 MiB limit. Resize it and try again.'
          : tooMany
            ? `Use at most ${LIMITS.maxImages} photographs in the images field.`
            : 'The upload form is too large or invalid. Check the instruction and photographs.',
      );
    } else if (error instanceof Error && /multipart|unexpected end of form/i.test(error.message)) {
      safe = new AppError(
        400,
        'INVALID_UPLOAD',
        'The image upload was interrupted or malformed. Please try again.',
      );
    }
    // Log only controlled codes. SDK messages may contain request data or secrets.
    if (safe.status >= 500) console.error(`[inspection] ${safe.code}`);
    res.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  };
  app.use(handleError);
  return app;
}
