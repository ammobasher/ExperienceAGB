import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './hosting',
  outputDir: process.env.E2E_OUTPUT_DIR ?? 'test-results-hosting',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5182/ExperienceAGB/',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    command: 'npm run build -- --base=/ExperienceAGB/ && node scripts/preview-host.mjs',
    url: 'http://127.0.0.1:5182/ExperienceAGB/',
    env: { AGB_HOST_BASE: '/ExperienceAGB/', AGB_HOST_PORT: '5182' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
