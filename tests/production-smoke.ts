import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const origin = 'http://127.0.0.1:3199';
const browser = await chromium.launch();
const server = spawn(process.execPath, ['dist/server/index.js'], {
  env: { ...process.env, PORT: '3199', GEMINI_API_KEY: '', GEMINI_MODEL: 'gemini-2.5-flash' },
  stdio: 'pipe',
  windowsHide: true,
});
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for the child server to bind. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, 'Built backend must start');
  const health = await (await fetch(`${origin}/api/health`)).json();
  assert.equal(health.configured, false);
  assert.equal(health.model, 'gemini-2.5-flash');
  const html = await fetch(origin);
  assert.equal(html.status, 200);
  assert(html.headers.get('content-security-policy')?.includes("connect-src 'self'"));
  const png = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#bbc9ac' } })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('mode', 'general');
  form.append('images', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'smoke.png');
  const result = await fetch(`${origin}/api/analyze`, {
    method: 'POST',
    headers: { 'X-Inspection-Request': '1' },
    body: form,
  });
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error.code, 'MISSING_API_KEY');
  const errors: string[] = [];
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await mkdir('test-results/production', { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(origin);
    await page.getByText('Gemini setup needed.').waitFor();
    assert(await page.getByRole('button', { name: 'Analyze photographs', exact: true }).isDisabled());
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `No overflow at ${width}px`,
    );
    await page.screenshot({ path: `test-results/production/${width}.png`, fullPage: true, scale: 'css' });
  }
  assert.deepEqual(errors, []);
  for (const filename of await readdir('dist/client/assets')) {
    if (filename.endsWith('.js')) {
      const source = await readFile(`dist/client/assets/${filename}`, 'utf8');
      assert(!source.includes('GoogleGenAI'), 'Gemini SDK must remain out of browser bundle');
      assert(!source.includes('GEMINI_API_KEY'), 'Secret configuration must remain out of browser bundle');
      assert(
        !source.includes('unit-test-only-not-a-real-key'),
        'Test data must remain out of browser bundle',
      );
    }
  }
  console.info(
    'Production smoke passed: built API, frontend, CSP, missing-key response, four viewport widths, no browser errors, and no server SDK/key configuration in client assets.',
  );
} finally {
  await browser.close();
  server.kill();
}
