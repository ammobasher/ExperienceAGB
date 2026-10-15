import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { observePerformance, readPerformance, settlePerformance } from './performanceHarness';

// Keep benchmark tracing from traversing the complete diagram on every action.
test.use({ trace: { mode: 'retain-on-failure', snapshots: false, screenshots: false } });

const MiB = 1024 * 1024;
const budgets = {
  cycles: 5,
  mainSampledLiveBytes: 64 * MiB,
  mainClosedAboveBaselineBytes: 24 * MiB,
  warmedClosedGrowthBytes: 4 * MiB,
  reloadAboveBaselineBytes: 8 * MiB,
  maximumMainTaskMs: 100,
};

function tree(depth: number): object {
  return depth ? { score: 0, sampleCount: 2 ** depth, split: `Feature${depth} < ${depth}`, left: tree(depth - 1), right: tree(depth - 1) }
    : { score: 0.001, sampleCount: 1 };
}

test('five large import/edit/close cycles bound sampled heap retention and terminate every worker', async ({ page, browser }, testInfo) => {
  const file = testInfo.outputPath('lifecycle-synthetic.json');
  const text = JSON.stringify({
    type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST',
    model: { booster: { trees: Array.from({ length: 130 }, () => tree(9)) } },
  });
  await writeFile(file, text);
  await observePerformance(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
  const main = await page.context().newCDPSession(page);
  const targets = await browser.newBrowserCDPSession();
  const workerCount = async () => (await targets.send('Target.getTargets')).targetInfos
    .filter(target => target.type === 'worker' && target.url.includes('/assets/model.worker-')).length;
  const heap = async () => (await main.send('Runtime.getHeapUsage')).usedSize;
  const collect = async () => { await main.send('HeapProfiler.collectGarbage'); return heap(); };
  const baseline = await collect();
  const cycles: Array<{ importMs: number; imported: number; edited: number; closed: number; remainingWorkers: number }> = [];
  const startedAt = await page.evaluate(() => performance.now());
  try {
    for (let cycle = 0; cycle < budgets.cycles; cycle++) {
      const start = Date.now();
      await page.locator('input[type=file]').setInputFiles(file);
      await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
      await settlePerformance(page);
      const importMs = Date.now() - start;
      const imported = await heap();
      expect(await workerCount(), 'one worker owns each active workspace').toBe(1);
      await page.locator('.workspace-actions').getByRole('button', { name: 'Trace a profile' }).click();
      await page.locator('.profile-editor summary').click();
      const value = page.locator('.profile-fields').getByRole('textbox', { name: 'Illustrative Feature1', exact: true });
      expect(await value.inputValue()).not.toBe('0');
      await value.fill('0');
      await expect(page.locator('.profile-trace').getByRole('button', { name: 'Inspect changed Tree 1', exact: true })).toBeVisible();
      await expect(page.locator('.stage-preview-result')).toContainText('Left');
      await settlePerformance(page);
      const edited = await heap();
      await page.locator('.workspace-heading').getByRole('button', { name: /Open another/ }).click();
      await expect(page.getByRole('region', { name: 'Model workspace' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
      await settlePerformance(page);
      await expect.poll(workerCount, { message: 'close terminates the local worker' }).toBe(0);
      const closed = await collect();
      cycles.push({ importMs, imported, edited, closed, remainingWorkers: await workerCount() });
      await writeFile(testInfo.outputPath('lifecycle-evidence.json'), JSON.stringify({ budgets, baseline, cycles, complete: false }, null, 2));
      expect(Math.max(imported, edited), 'sampled live renderer heap budget').toBeLessThanOrEqual(budgets.mainSampledLiveBytes);
      expect(closed - baseline, 'post-close renderer residual budget').toBeLessThanOrEqual(budgets.mainClosedAboveBaselineBytes);
    }
    const evidence = await readPerformance(page);
    const applicationTasks = evidence.tasks.filter(task => task.startTime + task.duration >= startedAt);
    await page.reload();
    await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
    const reloaded = await collect();
    await writeFile(testInfo.outputPath('lifecycle-evidence.json'), JSON.stringify({
      source: 'synthetic, not authentic corpus or score oracle', bytes: Buffer.byteLength(text), trees: 130, nodes: 132990,
      cpu: cpus()[0]?.model, browser: await page.evaluate(() => navigator.userAgent),
      budgets, baseline, cycles, reloaded, applicationTasks, transfers: evidence.transfers,
      limitations: 'Forced-GC V8 renderer samples, not peak/process RSS, worker heap, GPU/native memory, secure erasure or universal device budgets.',
    }, null, 2));
    expect(Math.max(...cycles.slice(2).map(cycle => cycle.closed)) - cycles[1].closed, 'closed heap growth after two warmup cycles')
      .toBeLessThanOrEqual(budgets.warmedClosedGrowthBytes);
    expect(reloaded - baseline, 'reload renderer heap budget').toBeLessThanOrEqual(budgets.reloadAboveBaselineBytes);
    expect(Math.max(0, ...applicationTasks.map(task => task.duration)), 'full repeated lifecycle interval, including closes and editors')
      .toBeLessThanOrEqual(budgets.maximumMainTaskMs);
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []]);
  } finally {
    if (!page.isClosed()) {
      await writeFile(testInfo.outputPath('lifecycle-interval-evidence.json'), JSON.stringify(await readPerformance(page), null, 2));
    }
    await main.detach();
    await targets.detach();
  }
});

test('invalid import leaves no analysis worker and allows a clean retry', async ({ page, browser }) => {
  await page.goto('/');
  const targets = await browser.newBrowserCDPSession();
  const workerCount = async () => (await targets.send('Target.getTargets')).targetInfos
    .filter(target => target.type === 'worker' && target.url.includes('/assets/model.worker-')).length;
  try {
    await page.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await expect(page.getByRole('button', { name: /Browse files/ })).toBeEnabled();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect.poll(workerCount).toBe(0);
    await page.getByRole('button', { name: /sample/i }).click();
    await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
    expect(await workerCount()).toBe(1);
    await page.getByRole('button', { name: /Open another/ }).click();
    await expect.poll(workerCount).toBe(0);
  } finally { await targets.detach(); }
});

test('cancel while a real worker is awaiting its import request releases that worker and permits retry', async ({ page, browser }) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    let holdFirstImport = true;
    window.Worker = class extends OriginalWorker {
      postMessage(message: unknown) {
        if (holdFirstImport && (message as { kind?: string }).kind === 'import') {
          holdFirstImport = false;
          return;
        }
        super.postMessage(message);
      }
    };
  });
  await page.goto('/');
  const targets = await browser.newBrowserCDPSession();
  const workerCount = async () => (await targets.send('Target.getTargets')).targetInfos
    .filter(target => target.type === 'worker' && target.url.includes('/assets/model.worker-')).length;
  try {
    await page.getByRole('button', { name: /sample/i }).click();
    await expect(page.getByRole('button', { name: 'Cancel import', exact: true })).toBeVisible();
    await expect.poll(workerCount).toBe(1);
    await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Import cancelled');
    await expect.poll(workerCount).toBe(0);
    await page.getByRole('button', { name: /sample/i }).click();
    await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
    expect(await workerCount()).toBe(1);
    await page.getByRole('button', { name: /Open another/ }).click();
    await expect.poll(workerCount).toBe(0);
  } finally { await targets.detach(); }
});
