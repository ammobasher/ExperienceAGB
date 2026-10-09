import { defineConfig } from '@playwright/test';
import { assertPrivateCorpusOutput } from './e2e/privateCorpusOutput';

if (process.env.AGB_PRIVATE_RBO_EXPORT || process.env.AGB_PRIVATE_WEB_EXPORT) {
  assertPrivateCorpusOutput(process.cwd(), process.env.E2E_OUTPUT_DIR);
}
const port = Number(process.env.E2E_PORT ?? 5180);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('E2E_PORT must be an integer from 1024 to 65535.');

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/hosting/**',
  outputDir: process.env.E2E_OUTPUT_DIR ?? 'test-results',
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
