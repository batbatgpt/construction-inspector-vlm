import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: 'node --import tsx server/index.ts',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: false,
      env: { GEMINI_API_KEY: '', GEMINI_MODEL: 'gemini-3.6-flash', PORT: '3001' },
      timeout: 30_000,
    },
    {
      command: 'node node_modules/vite/bin/vite.js',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      env: { PORT: '3001' },
      timeout: 30_000,
    },
  ],
});
