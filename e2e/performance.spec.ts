import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';

function tree(depth: number, unique = false, path = 'root'): object {
  return depth === 0 ? { score: 0.001, sampleCount: 1 } : {
    score: 0, sampleCount: 2 ** depth, split: `${unique ? path : `Feature${depth}`} < ${depth}`,
    left: tree(depth - 1, unique, `${path}.L`), right: tree(depth - 1, unique, `${path}.R`),
  };
}

test('large admitted synthetic import and actual edits avoid >100ms main-thread tasks', async ({ page }, testInfo) => {
  const text = JSON.stringify({
    type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST',
    model: { booster: { trees: Array.from({ length: 130 }, () => tree(9)) } },
  });

  const file = testInfo.outputPath('synthetic-performance.json');
  await writeFile(file, text);
  await page.addInitScript(() => {
    const timings: number[] = [];
    Object.assign(window, { reviewLongTasks: timings });
    new PerformanceObserver(list => timings.push(...list.getEntries().map(entry => entry.duration)))
      .observe({ type: 'longtask', buffered: true });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
  await page.evaluate(() => { Reflect.get(window, 'reviewLongTasks').length = 0; });
  const start = Date.now();
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const importMs = Date.now() - start;
  const importTasks: number[] = await page.evaluate(() => [...Reflect.get(window, 'reviewLongTasks')]);
  await page.getByRole('button', { name: 'Trace a profile' }).click();
  await page.getByText(/Edit illustrative profile/).click();
  const value = page.getByRole('textbox', { name: 'Illustrative Feature1', exact: true });
  await page.evaluate(() => { Reflect.get(window, 'reviewLongTasks').length = 0; });
  const editStart = Date.now();
  await value.fill('0');
  await expect(page.locator('.stage-preview-result')).toContainText('Left');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const editMs = Date.now() - editStart;
  const editTasks: number[] = await page.evaluate(() => [...Reflect.get(window, 'reviewLongTasks')]);
  const evidence = JSON.stringify({
      source: 'synthetic, not Pega oracle or authentic corpus', bytes: Buffer.byteLength(text),
      trees: 130, nodes: 132990, cpu: cpus()[0]?.model, browser: await page.evaluate(() => navigator.userAgent),
      importMs, importTasks, editMs, editTasks,
      workerTimings: await page.locator('[data-worker-parse-ms]').evaluate(element => ({
        parseMs: Number(element.getAttribute('data-worker-parse-ms')),
        analysisMs: Number(element.getAttribute('data-worker-analysis-ms')),
      })),
    }, null, 2);
  const evidenceFile = testInfo.outputPath('performance-evidence.json');
  await writeFile(evidenceFile, evidence);
  await testInfo.attach('performance-evidence', { path: evidenceFile, contentType: 'application/json' });
  expect(Math.max(0, ...importTasks), 'import main-thread blocking').toBeLessThanOrEqual(100);
  expect(Math.max(0, ...editTasks), 'changed profile main-thread blocking').toBeLessThanOrEqual(100);
  expect(await page.locator('.tree-node').count(), 'bounded SVG rendering').toBeLessThanOrEqual(127);
});

test('high-cardinality predictors and profile editors stay bounded and responsive', async ({ page }, testInfo) => {
  const file = testInfo.outputPath('high-cardinality.json');
  await writeFile(file, JSON.stringify({
    type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST',
    model: { booster: { trees: [tree(12, true)] } },
  }));
  await page.addInitScript(() => {
    const timings: number[] = [];
    Object.assign(window, { reviewLongTasks: timings });
    new PerformanceObserver(list => timings.push(...list.getEntries().map(entry => entry.duration))).observe({ type: 'longtask', buffered: true });
  });
  await page.goto('/');
  await page.evaluate(() => { Reflect.get(window, 'reviewLongTasks').length = 0; });
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Trace a profile' }).click();
  await page.getByText(/Edit illustrative profile/).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const tasks: number[] = await page.evaluate(() => [...Reflect.get(window, 'reviewLongTasks')]);
  const report = testInfo.outputPath('high-cardinality-evidence.json');
  await writeFile(report, JSON.stringify({ predictors: 4095, nodes: 8191, tasks }, null, 2));
  expect(await page.locator('.predictor-group').count()).toBeLessThanOrEqual(20);
  expect(await page.locator('.profile-field').count()).toBeLessThanOrEqual(25);
  expect(Math.max(0, ...tasks), 'high-cardinality import/editor blocking').toBeLessThanOrEqual(100);
});
