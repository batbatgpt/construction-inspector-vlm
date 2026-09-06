import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import analyzeApp from '../api/analyze.js';
import healthApp from '../api/health.js';
import { getConfig } from '../server/config.js';

afterEach(() => vi.unstubAllEnvs());

it('serves the Vercel API entry points without starting a local listener', async () => {
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('GEMINI_MODEL', '');
  const health = await request(healthApp).get('/api/health');
  expect(health.status).toBe(200);
  expect(health.body).toMatchObject({ configured: false, model: 'gemini-3.6-flash' });
  const missing = await request(analyzeApp)
    .post('/api/analyze')
    .set('X-Inspection-Request', '1')
    .field('mode', 'general');
  expect(missing.body.error.code).toBe('NO_IMAGES');
  vi.stubEnv('GEMINI_MODEL', 'user-selected-vision-model');
  expect(getConfig().model).toBe('user-selected-vision-model');
});
