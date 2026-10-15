import { test, expect, type CDPSession } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { observePerformance, readPerformance, settlePerformance } from './performanceHarness';

// Trace DOM snapshots traverse the full SVG and distort large-tree timings.
test.use({ trace: { mode: 'retain-on-failure', snapshots: false, screenshots: false } });

let profiling: CDPSession | undefined;
test.beforeEach(async ({ page }) => {
  if (process.env.AGB_PROFILE_TIMELINE !== '1') return;
  profiling = await page.context().newCDPSession(page);
  await profiling.send('Tracing.start', {
    categories: 'devtools.timeline,v8,disabled-by-default-v8.cpu_profiler',
    transferMode: 'ReturnAsStream',
  });
});
test.afterEach(async ({ page }, testInfo) => {
  if (!page.isClosed()) {
    await writeFile(testInfo.outputPath('interval-evidence.json'), JSON.stringify(await readPerformance(page), null, 2));
  }
  if (!profiling) return;
  const session = profiling;
  profiling = undefined;
  try {
    const completed = new Promise<string>(resolve => session.once('Tracing.tracingComplete', event => resolve(event.stream!)));
    await session.send('Tracing.end');
    const stream = await completed;
    const chunks: Buffer[] = [];
    let eof = false;
    while (!eof) {
      const result = await session.send('IO.read', { handle: stream });
      chunks.push(Buffer.from(result.data, result.base64Encoded ? 'base64' : 'utf8'));
      eof = result.eof;
    }
    await session.send('IO.close', { handle: stream });
    await writeFile(testInfo.outputPath('diagnostic-timeline.json'), Buffer.concat(chunks));
  } finally { await session.detach(); }
});

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
  await observePerformance(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
  const importAt = await page.evaluate(() => performance.now());
  const start = Date.now();
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.diagram-workspace')?.getAttribute('aria-busy') === 'false');
  await settlePerformance(page);
  const importMs = Date.now() - start;
  const importEvidence = await readPerformance(page);
  const importTasks = importEvidence.tasks.filter(task => task.startTime + task.duration >= importAt).map(task => task.duration);
  const chunks = importEvidence.transfers.filter(message => message.kind === 'nodes');
  expect(chunks.reduce((total, message) => total + (message.entries ?? 0), 0), 'all admitted nodes transferred').toBe(132990);
  expect(Math.max(...chunks.map(message => message.entries ?? 0)), 'transfer chunk budget').toBeLessThanOrEqual(512);
  expect(await page.locator('.tree-row').count(), 'bounded ensemble navigation').toBeLessThanOrEqual(25);
  expect(await page.locator('.predictor-group button').count(), 'closed predictors do not mount hidden occurrence buttons').toBe(0);
  await page.locator('.workspace-actions').getByRole('button', { name: 'Trace a profile' }).click();
  await page.locator('.profile-editor summary').click();
  const value = page.locator('.profile-fields').getByRole('textbox', { name: 'Illustrative Feature1', exact: true });
  await settlePerformance(page);
  const editAt = await page.evaluate(() => performance.now());
  expect(await value.inputValue(), 'edit must change the supplied value').not.toBe('0');
  const editStart = Date.now();
  await value.fill('0');
  await expect(page.locator('.stage-preview-result')).toContainText('Left');
  await expect(page.locator('.profile-trace').getByRole('button', { name: 'Inspect changed Tree 1', exact: true })).toBeVisible();
  await settlePerformance(page);
  const editMs = Date.now() - editStart;
  const allEvidence = await readPerformance(page);
  const editTasks = allEvidence.tasks.filter(task => task.startTime + task.duration >= editAt).map(task => task.duration);
  const evidence = JSON.stringify({
      source: 'synthetic, not Pega oracle or authentic corpus', bytes: Buffer.byteLength(text),
      trees: 130, nodes: 132990, cpu: cpus()[0]?.model, browser: await page.evaluate(() => navigator.userAgent),
      importMs, importTasks, editMs, editTasks, allEvidence,
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
  expect(Math.max(0, ...allEvidence.tasks.filter(task => task.startTime + task.duration >= importAt).map(task => task.duration)),
    'entire import, editor opening and edit interval').toBeLessThanOrEqual(100);
  expect(await page.locator('.tree-node').count(), 'complete selected-tree rendering').toBe(1023);
});

test('high-cardinality predictors and profile editors stay bounded and responsive', async ({ page }, testInfo) => {
  const file = testInfo.outputPath('high-cardinality.json');
  await writeFile(file, JSON.stringify({
    type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST',
    model: { booster: { trees: [tree(12, true)] } },
  }));
  await observePerformance(page);
  await page.goto('/');
  const importAt = await page.evaluate(() => performance.now());
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.diagram-workspace')?.getAttribute('aria-busy') === 'false');
  expect(await page.evaluate(() => ({
    nodes: document.querySelectorAll('.tree-node').length,
    leaves: document.querySelectorAll('.tree-node.is-leaf').length,
    links: document.querySelectorAll('.tree-links path').length,
  }))).toEqual({ nodes: 8191, leaves: 4096, links: 8190 });
  const drawingCompleteAt = await page.evaluate(() => performance.now());
  await page.locator('.workspace-actions').getByRole('button', { name: 'Trace a profile' }).click();
  const traceOpenedAt = await page.evaluate(() => performance.now());
  await page.locator('.profile-editor summary').click();
  const editorOpenedAt = await page.evaluate(() => performance.now());
  await settlePerformance(page);
  const evidence = await readPerformance(page);
  const tasks = evidence.tasks.filter(task => task.startTime + task.duration >= importAt).map(task => task.duration);
  const report = testInfo.outputPath('high-cardinality-evidence.json');
  await writeFile(report, JSON.stringify({ predictors: 4095, nodes: 8191, drawingCompleteAt, traceOpenedAt, editorOpenedAt, tasks, evidence }, null, 2));
  expect(await page.locator('.predictor-group').count()).toBeLessThanOrEqual(20);
  expect(await page.locator('.profile-field').count()).toBeLessThanOrEqual(25);
  expect(await page.locator('.predictor-group button').count(), 'closed high-cardinality predictors do not mount hidden buttons').toBe(0);
  expect(Math.max(0, ...tasks), 'high-cardinality import/editor blocking').toBeLessThanOrEqual(100);
});
