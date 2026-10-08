import { defineConfig } from '@playwright/test';
import { assertPrivateCorpusOutput } from './e2e/privateCorpusOutput';

if (process.env.AGB_PRIVATE_RBO_EXPORT || process.env.AGB_PRIVATE_WEB_EXPORT) {
  assertPrivateCorpusOutput(process.cwd(), process.env.E2E_OUTPUT_DIR);
}

export default defineConfig({
  testDir: './e2e',
  outputDir: process.env.E2E_OUTPUT_DIR ?? 'test-results',
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5180',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
