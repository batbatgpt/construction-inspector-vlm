import request from 'supertest';
import sharp from 'sharp';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.js';
import { prepareImages } from '../server/images.js';
import { LIMITS } from '../shared/config.js';
import { resultFixture } from './fixtures.js';

let png: Buffer;
beforeAll(async () => {
  png = await sharp({ create: { width: 48, height: 32, channels: 3, background: '#adbba4' } })
    .png()
    .toBuffer();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const appForTest = () =>
  createApp({ analyzer: vi.fn(async () => ({ result: resultFixture, model: 'unit-test-model' })) });
const post = (app = appForTest()) => request(app).post('/api/analyze').set('X-Inspection-Request', '1');
const file = (buffer: Buffer, mimetype = 'image/png') => ({ buffer, mimetype }) as Express.Multer.File;

describe('API input validation', () => {
  it('rejects a combined upload one byte above the hosted budget before decoding', async () => {
    const half = LIMITS.maxTotalBytes / 2;
    const response = await post()
      .field('mode', 'general')
      .attach('images', Buffer.alloc(half), 'one.png')
      .attach('images', Buffer.alloc(half + 1), 'two.png');
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('TOTAL_TOO_LARGE');
  });
  it('accepts exactly six photographs with both form fields', async () => {
    let upload = post().field('mode', 'general').field('instruction', 'Inspect all six views.');
    for (let i = 0; i < LIMITS.maxImages; i++) upload = upload.attach('images', png, `${i}.png`);
    const response = await upload;
    expect(response.status).toBe(200);
    expect(response.body.metadata.imageCount).toBe(6);
  });
  it('requires images and a valid inspection scope', async () => {
    expect((await post().field('mode', 'general')).body.error.code).toBe('NO_IMAGES');
    expect((await post().field('mode', 'unknown').attach('images', png, 'site.png')).status).toBe(400);
    expect(
      (await post().field('mode', 'custom').field('instruction', ' ').attach('images', png, 'site.png')).body
        .error.code,
    ).toBe('INVALID_INPUT');
    expect(
      (
        await post()
          .field('mode', 'general')
          .field('instruction', 'a'.repeat(2001))
          .attach('images', png, 'site.png')
      ).status,
    ).toBe(400);
  });
  it('requires the application header and multipart format', async () => {
    expect((await request(appForTest()).post('/api/analyze').field('mode', 'general')).status).toBe(403);
    expect((await post().send({ mode: 'general' })).status).toBe(415);
  });
  it('rejects unsupported types, MIME spoofing, and corrupt image bytes', async () => {
    expect(
      (await post().field('mode', 'general').attach('images', Buffer.from('<svg/>'), 'site.svg')).body.error
        .code,
    ).toBe('UNSUPPORTED_TYPE');
    expect(
      (
        await post()
          .field('mode', 'general')
          .attach('images', png, { filename: 'site.jpg', contentType: 'image/jpeg' })
      ).body.error.code,
    ).toBe('INVALID_IMAGE');
    expect(
      (await post().field('mode', 'general').attach('images', Buffer.from('not an image'), 'site.png')).body
        .error.code,
    ).toBe('INVALID_IMAGE');
  });
  it('rejects per-file and image-count overflow', async () => {
    expect(
      (
        await post()
          .field('mode', 'general')
          .attach('images', Buffer.alloc(LIMITS.maxFileBytes + 1), 'large.png')
      ).status,
    ).toBe(413);
    let upload = post().field('mode', 'general');
    for (let i = 0; i < 7; i++) upload = upload.attach('images', png, `${i}.png`);
    expect((await upload).status).toBe(400);
  });
  it('rejects aggregate size and excessive decoded dimensions', async () => {
    await expect(
      prepareImages(Array.from({ length: 4 }, () => file(Buffer.alloc(LIMITS.maxFileBytes)))),
    ).rejects.toMatchObject({ code: 'TOTAL_TOO_LARGE' });
    const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#ffffff' } })
      .png()
      .toBuffer();
    await expect(prepareImages([file(huge)])).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });
  it('decodes images, normalizes orientation, strips metadata, and keeps numbering order', async () => {
    const tagged = await sharp(png).withMetadata({ orientation: 6 }).png().toBuffer();
    const prepared = await prepareImages([file(tagged), file(png)]);
    expect(prepared).toHaveLength(2);
    const first = await sharp(Buffer.from(prepared[0].data, 'base64')).metadata();
    expect(first.format).toBe('jpeg');
    expect(first.width).toBe(32);
    expect(first.height).toBe(48);
    expect(first.exif).toBeUndefined();
    expect(first.orientation).toBeUndefined();
  });
  it('returns validated JSON and report context through the endpoint (analyzer test double)', async () => {
    const response = await post()
      .field('mode', 'custom')
      .field('instruction', 'Inspect access.')
      .attach('images', png, 'one.png')
      .attach('images', png, 'two.png');
    expect(response.status).toBe(200);
    expect(response.body.result).toEqual(resultFixture);
    expect(response.body.metadata).toMatchObject({
      mode: 'custom',
      instruction: 'Inspect access.',
      imageCount: 2,
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('returns a clear missing-key error from the real production analyzer', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await post(createApp()).field('mode', 'general').attach('images', png, 'site.png');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('MISSING_API_KEY');
    expect(response.body).not.toHaveProperty('result');
  });
  it('sanitizes unexpected errors and exposes no secrets in health', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'unit-test-secret');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp({
      analyzer: async () => {
        throw new Error('unit-test-secret stack details');
      },
    });
    const response = await post(app).field('mode', 'general').attach('images', png, 'site.png');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toMatch(/unit-test-secret|stack details/);
    const health = await request(app).get('/api/health');
    expect(health.body.configured).toBe(true);
    expect(JSON.stringify(health.body)).not.toContain('unit-test-secret');
  });
});
