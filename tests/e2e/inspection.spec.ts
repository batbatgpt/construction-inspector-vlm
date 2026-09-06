import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { reportFixture } from '../fixtures.js';

let png: Buffer;
test.beforeAll(async () => {
  png = await sharp({ create: { width: 480, height: 320, channels: 3, background: '#b2bda8' } })
    .png()
    .toBuffer();
});
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

async function upload(page: Page, count = 2) {
  await page.getByLabel('Upload construction photographs').setInputFiles(
    Array.from({ length: count }, (_, index) => ({
      name: `site-${index + 1}.png`,
      mimeType: 'image/png',
      buffer: png,
    })),
  );
  await expect(page.getByText(`${count} photograph${count === 1 ? '' : 's'} added`)).toBeVisible();
}
async function mockReport(page: Page) {
  // Only the browser test substitutes an analysis response. The app has no demo mode.
  await page.route('**/api/analyze', async (route) => route.fulfill({ json: reportFixture }));
  await upload(page);
  await page.getByRole('button', { name: 'Analyze photographs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evidence & findings' })).toBeVisible();
}

test('initial view is accessible, has no horizontal overflow, and requires a photograph', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('heading', { name: 'Construction Inspector VLM' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyze photographs', exact: true })).toBeDisabled();
  await expect(page.getByText('Gemini setup needed.')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('initial.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('uploads, previews, removes, clears, and resets photographs', async ({ page }) => {
  await upload(page);
  await page.getByRole('button', { name: 'View Image 2:' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close photograph viewer' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Remove Image 1', exact: true }).click();
  await expect(page.getByText('1 photograph added')).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Image 1: site-2.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByText('0 / 6')).toBeVisible();
  await upload(page, 1);
  await page.getByRole('radio', { name: /Custom analysis/ }).check();
  await expect(page.getByRole('button', { name: 'Analyze photographs', exact: true })).toBeDisabled();
  await page.getByLabel('Your inspection question').fill('Inspect the visible access route.');
  await expect(page.getByRole('button', { name: 'Analyze photographs', exact: true })).toBeEnabled();
  await page.locator('.header-actions button').click();
  await expect(page.getByText('0 / 6')).toBeVisible();
  await expect(page.getByRole('radio', { name: /General site/ })).toBeChecked();
  await expect(page.getByLabel('Notes or a specific question')).toHaveValue('');
});

test('supports drag and drop and rejects invalid selections', async ({ page }) => {
  const transfer = await page.evaluateHandle(
    (bytes) => {
      const data = new DataTransfer();
      data.items.add(new File([Uint8Array.from(bytes)], 'dropped.png', { type: 'image/png' }));
      return data;
    },
    [...png],
  );
  await page.locator('.dropzone').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByText('1 photograph added')).toBeVisible();
  await page
    .getByLabel('Upload construction photographs')
    .setInputFiles({ name: 'text.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByRole('alert')).toContainText('choose a JPEG, PNG, or WebP');
  await expect(page.getByText('1 photograph added')).toBeVisible();
  await page
    .getByLabel('Upload construction photographs')
    .setInputFiles(
      Array.from({ length: 6 }, (_, i) => ({ name: `${i}.png`, mimeType: 'image/png', buffer: png })),
    );
  await expect(page.getByRole('alert')).toContainText('up to 6 photographs');
});

test('the real frontend and backend return a missing-key error without fake results', async ({ page }) => {
  await upload(page, 1);
  await page.getByRole('button', { name: 'Analyze photographs', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Gemini is not configured');
  await expect(page.getByRole('heading', { name: 'Evidence & findings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Analyze photographs', exact: true })).toBeEnabled();
});

test('renders structured findings, image references, JSON, clipboard, and print report (test response)', async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockReport(page);
  for (const title of [
    'Direct Observations',
    'Possible Interpretations',
    'Possible Concerns',
    'Cannot Determine',
    'Recommended Follow-Up',
  ])
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.locator('.image-refs button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Copy report text' }).click();
  await expect(page.getByRole('status')).toContainText('Report copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Recommended Follow-Up');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.result).toEqual(reportFixture.result);
  expect(exported.metadata.imageCount).toBe(2);
  expect(JSON.stringify(exported)).not.toMatch(/GEMINI_API_KEY|systemInstruction/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('report.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.setup-column')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Recommended Follow-Up' })).toBeVisible();
  await expect(page.locator('.report-meta')).toContainText('2 photographs');
  if (testInfo.project.name === 'desktop')
    await page.pdf({ path: testInfo.outputPath('report.pdf'), format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await page.getByLabel('Notes or a specific question').fill('Changed context.');
  await expect(page.getByRole('heading', { name: 'Evidence & findings' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Inspection inputs changed');
});

test('cancellation and reset prevent late results from replacing current state', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/analyze', async (route) => {
    await gate;
    await route.fulfill({ json: reportFixture }).catch(() => {});
  });
  await upload(page);
  await page.getByRole('button', { name: 'Analyze photographs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analyzing photographs…' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel inspection' }).click();
  await expect(page.getByRole('status')).toContainText('Inspection cancelled');
  release();
  await expect(page.getByRole('heading', { name: 'Evidence & findings' })).toHaveCount(0);
  await expect(page.getByText('2 photographs added')).toBeVisible();
  await page.locator('.header-actions button').click();
  await expect(page.getByText('0 / 6')).toBeVisible();
});

test('untrusted model strings are rendered as text and malformed output is rejected', async ({ page }) => {
  await page.route('**/api/analyze', async (route) =>
    route.fulfill({
      json: {
        ...reportFixture,
        result: { ...reportFixture.result, summary: '<img src=x onerror="window.hacked=true">' },
      },
    }),
  );
  await upload(page);
  await page.getByRole('button', { name: 'Analyze photographs', exact: true }).click();
  await expect(page.locator('.summary-card p')).toHaveText('<img src=x onerror="window.hacked=true">');
  await expect(page.locator('.summary-card img')).toHaveCount(0);
  await page.route('**/api/analyze', async (route) => route.fulfill({ json: { result: {} } }));
  await page.getByRole('button', { name: 'Analyze photographs', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('invalid inspection report');
});
