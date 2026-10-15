import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { observePerformance, readPerformance, settlePerformance } from './performanceHarness';

test.use({ trace: { mode: 'retain-on-failure', snapshots: false, screenshots: false } });

test('4095-predictor insights and worker audit export preserve the 100ms main-thread gate', async ({ page }, testInfo) => {
  function tree(depth: number, path = 'root'): object {
    return depth ? { score: 0, gain: .1, sampleCount: 2 ** depth, split: `${path} < ${depth}`, left: tree(depth - 1, `${path}.L`), right: tree(depth - 1, `${path}.R`) } : { score: .1, sampleCount: 1 };
  }
  const file = testInfo.outputPath('synthetic-high-cardinality-audit.json');
  await writeFile(file, JSON.stringify({ type: 'AdaptiveBoostScoringModel', algorithm: 'GRADIENT_BOOST', modelVersion: '2', model: { booster: { trees: [tree(12)] } } }));
  await observePerformance(page);
  await page.goto('/');
  const started = await page.evaluate(() => performance.now());
  await page.locator('input[type=file]').setInputFiles(file);
  const inputSetAt = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => document.querySelector('.diagram-workspace')?.getAttribute('aria-busy') === 'false');
  expect(await page.locator('.tree-node').count()).toBe(8191);
  const drawingCompleteAt = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: 'Model insights', exact: true }).click();
  const insightsOpenedAt = await page.evaluate(() => performance.now());
  const audit = page.getByRole('region', { name: 'Local model insights', exact: true });
  await audit.getByRole('button', { name: 'Predictors', exact: true }).click();
  const predictorsOpenedAt = await page.evaluate(() => performance.now());
  await expect(audit.getByRole('table', { name: 'Exact predictor evidence across the ensemble (4095 matches)', exact: true }).locator('tbody tr')).toHaveCount(20);
  await audit.getByRole('button', { name: 'History & context', exact: true }).click();
  const historyOpenedAt = await page.evaluate(() => performance.now());
  await expect(audit.getByRole('table', { name: 'Numeric, membership and missing-check inventory (4095 matches)', exact: true }).locator('tbody tr')).toHaveCount(20);
  await audit.getByRole('checkbox').check();
  await audit.getByRole('button', { name: 'Prepare evidence bundle JSON', exact: true }).click();
  await expect(audit.getByRole('link', { name: 'Save prepared audit JSON', exact: true })).toBeVisible();
  await settlePerformance(page);
  const evidence = await readPerformance(page);
  const tasks = evidence.tasks.filter(task => task.startTime + task.duration >= started).map(task => task.duration);
  await writeFile(testInfo.outputPath('audit-performance.json'), JSON.stringify({ predictors: 4095, nodes: 8191, started, inputSetAt, drawingCompleteAt, insightsOpenedAt, predictorsOpenedAt, historyOpenedAt, tasks, evidence }, null, 2));
  expect(Math.max(0, ...tasks), 'import, insight navigation and worker-export interval').toBeLessThanOrEqual(100);
  expect(evidence.transfers.some(message => message.kind === 'audit-export')).toBe(true);
});
