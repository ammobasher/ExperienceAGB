import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { observePerformance, readPerformance, settlePerformance } from './performanceHarness';

test.use({ trace: { mode: 'retain-on-failure', snapshots: false, screenshots: false } });
test('1000-interval companion stays paginated and preserves the 100ms main-thread gate', async ({ page }, testInfo) => {
  const model = JSON.stringify({ type: 'AdaptiveBoostScoringModel', algorithm: 'GRADIENT_BOOST', modelVersion: '2', model: { booster: { trees: [{ score: 100, sampleCount: 1 }] } } });
  const companion = {
    schema: 'experience-agb-propensity-mapping-v1', sourceSha256: createHash('sha256').update(model).digest('hex'),
    exportTag: '2', exportUpdateTime: null, inputDomain: 'raw-score', method: 'exported-values',
    context: { modelId: 'synthetic-only', action: 'test', channel: 'test', direction: 'test' },
    provenance: { reference: 'Synthetic performance fixture', platformVersion: 'test', capturedAt: '2024-01-01T00:00:00.000Z' },
    bins: Array.from({ length: 1000 }, (_, index) => ({ lower: index, upper: index + 1, propensity: index / 1000, positives: index, negatives: 1000 - index })),
  };
  const modelFile = testInfo.outputPath('mapping-performance-model.json'), mappingFile = testInfo.outputPath('mapping-performance-companion.json');
  await writeFile(modelFile, model); await writeFile(mappingFile, JSON.stringify(companion));
  await observePerformance(page);
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(modelFile);
  await page.getByRole('button', { name: 'Trace a profile', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Optional Pega score-to-propensity mapping', exact: true });
  await panel.getByText('Import or prepare a companion mapping', { exact: true }).click();
  const started = await page.evaluate(() => performance.now());
  await panel.getByLabel('Companion mapping JSON', { exact: true }).setInputFiles(mappingFile);
  await expect(panel).toContainText('Companion loaded locally');
  await panel.getByRole('checkbox', { name: /I confirm this mapping/ }).check();
  await expect(panel.locator('.mapping-probability')).toHaveText('10%');
  await expect(panel.getByRole('row', { name: /101 — matched/ })).toBeVisible();
  await expect(panel.locator('tbody tr')).toHaveCount(20);
  await panel.getByRole('button', { name: 'Next intervals', exact: true }).click();
  await expect(panel.locator('tbody tr')).toHaveCount(20);
  await settlePerformance(page);
  const evidence = await readPerformance(page), tasks = evidence.tasks.filter(task => task.startTime + task.duration >= started).map(task => task.duration);
  await writeFile(testInfo.outputPath('mapping-performance.json'), JSON.stringify({ intervals: 1000, renderedRows: 20, fileBytes: Buffer.byteLength(JSON.stringify(companion)), tasks, evidence }, null, 2));
  expect(Math.max(0, ...tasks), 'full companion read/parse/render/confirmation/paging interval').toBeLessThanOrEqual(100);
});
