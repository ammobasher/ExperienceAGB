import { test, expect, type CDPSession } from '@playwright/test';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { parseAGBText } from '../src/domain/importModel';
import { analyseModel } from '../src/domain/modelAnalysis';
import { assertPrivateCorpusOutput } from './privateCorpusOutput';

test.use({ screenshot: 'off', trace: 'off' });

async function workerHeap(session: CDPSession) {
  const targets = await session.send('Target.getTargets');
  const worker = targets.targetInfos.find(target => target.type === 'worker' && target.url.includes('/assets/model.worker-'));
  if (!worker) throw new Error('No live local analysis worker is available for the memory snapshot.');
  const { sessionId } = await session.send('Target.attachToTarget', { targetId: worker.targetId, flatten: false });
  try {
    return await new Promise<{ usedSize: number; totalSize: number }>((resolveResult, reject) => {
      const cleanup = () => { clearTimeout(timeout); session.off('Target.receivedMessageFromTarget', receive); };
      const receive = (event: { sessionId: string; message: string }) => {
        if (event.sessionId !== sessionId) return;
        const response = JSON.parse(event.message);
        if (response.id !== 1) return;
        cleanup();
        if (response.error || typeof response.result?.usedSize !== 'number' || typeof response.result?.totalSize !== 'number') {
          reject(new Error('The browser did not return a valid worker heap snapshot.'));
        } else resolveResult({ usedSize: response.result.usedSize, totalSize: response.result.totalSize });
      };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Worker heap measurement timed out.')); }, 10_000);
      session.on('Target.receivedMessageFromTarget', receive);
      session.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id: 1, method: 'Runtime.getHeapUsage' }) })
        .catch(error => { cleanup(); reject(error); });
    });
  } finally { await session.send('Target.detachFromTarget', { sessionId }); }
}

for (const [label, variable] of [['RBO', 'AGB_PRIVATE_RBO_EXPORT'], ['Web', 'AGB_PRIVATE_WEB_EXPORT']] as const) {
  test(`private ${label} corpus: import, real edit, navigation, memory and cleanup`, async ({ page, browser }, testInfo) => {
    const file = process.env[variable];
    test.skip(!file, 'An owner-supplied private corpus path is required; fixtures are not stored in the repository.');
    assertPrivateCorpusOutput(process.cwd(), process.env.E2E_OUTPUT_DIR);
    const bytes = (await stat(file!)).size;
    const parsed = parseAGBText(await readFile(file!, 'utf8'), bytes);
    if (!parsed.model) throw new Error('The owner-supplied private corpus was rejected by the canonical adapter.');
    const prepared = analyseModel(parsed.model);
    const analysis = prepared.summary;
    const numericFeatures = new Set(analysis.features.filter(feature => feature.kind === 'number').map(feature => feature.name));
    const targetIndex = parsed.model.trees.findIndex(tree => tree.condition?.operator === 'lt' && numericFeatures.has(tree.condition.feature));
    if (targetIndex < 0) throw new Error('No supported numeric root is available for a measurable changed-route edit.');
    const condition = parsed.model.trees[targetIndex].condition!;
    const threshold = condition.threshold!;
    await page.addInitScript(() => {
      const durations: number[] = [];
      Object.assign(window, { corpusLongTasks: durations });
      new PerformanceObserver(list => durations.push(...list.getEntries().map(entry => entry.duration)))
        .observe({ type: 'longtask', buffered: true });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
    const pageSession = await page.context().newCDPSession(page);
    const browserSession = await browser.newBrowserCDPSession();
    const settle = () => page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const clearTasks = () => page.evaluate(() => { Reflect.get(window, 'corpusLongTasks').length = 0; });
    const tasks = (): Promise<number[]> => page.evaluate(() => [...Reflect.get(window, 'corpusLongTasks')]);
    const memoryBefore = await pageSession.send('Runtime.getHeapUsage');
    await clearTasks();
    const importStart = Date.now();
    await page.locator('input[type=file]').setInputFiles(file!);
    await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
    await settle();
    const importMs = Date.now() - importStart;
    const importTasks = await tasks();
    await expect(page.locator('.version-tag')).toHaveText(`Export tag: ${parsed.model.modelVersion}`);
    await expect(page.getByLabel('Model structure summary')).toContainText(parsed.nodeCount.toLocaleString());
    await expect(page.getByLabel('Model structure summary')).toContainText(parsed.model.trees.length.toLocaleString());
    const mainHeapAfterImport = await pageSession.send('Runtime.getHeapUsage');
    const workerHeapAfterImport = await workerHeap(browserSession);
    const workerTimings = await page.locator('[data-worker-parse-ms]').evaluate(element => ({
      parseMs: Number(element.getAttribute('data-worker-parse-ms')),
      analysisMs: Number(element.getAttribute('data-worker-analysis-ms')),
    }));
    await clearTasks();
    await page.getByRole('button', { name: 'Trace a profile' }).click();
    await page.getByText(/Edit illustrative profile/).click();
    await settle();
    const editorTasks = await tasks();
    await page.getByRole('searchbox', { name: 'Filter features' }).fill(condition.feature);
    const input = page.getByRole('textbox', { name: `Illustrative ${condition.feature}`, exact: true });
    const initial = Number(await input.inputValue());
    const changed = initial < threshold ? threshold : threshold - Math.max(1, Math.abs(threshold) * 0.000001);
    expect(Number.isFinite(changed) && changed !== initial, 'edit must be finite and change the value').toBe(true);
    await clearTasks();
    const editStart = Date.now();
    await input.fill(String(changed));
    await expect(page.getByRole('button', { name: `Inspect changed Tree ${targetIndex + 1}`, exact: true })).toBeVisible();
    await settle();
    const editMs = Date.now() - editStart;
    const editTasks = await tasks();
    const mainHeapAfterEdit = await pageSession.send('Runtime.getHeapUsage');
    await page.getByRole('button', { name: 'Explore trees' }).click();
    await page.getByRole('searchbox', { name: 'Search trees' }).fill(`Tree ${targetIndex + 1}`);
    await page.getByRole('button', { name: new RegExp(`Tree ${targetIndex + 1} \\d+ leaves$`) }).click();
    await expect(page.locator('.tree-node[data-node-id="root"]')).toBeFocused();
    await page.getByRole('searchbox', { name: 'Search predictors' }).fill(condition.feature);
    const group = page.locator('.predictor-group').filter({ has: page.getByText(condition.feature, { exact: true }) });
    await group.locator('summary').click();
    const occurrences = prepared.occurrences.get(condition.feature)!;
    const occurrenceOffset = occurrences.length > 20 ? 20 : 0;
    if (occurrenceOffset) await group.getByRole('button', { name: 'Next splits' }).click();
    const occurrence = occurrences[occurrenceOffset];
    const occurrenceButton = group.getByRole('button', { name: `Tree ${occurrence.treeIndex + 1}, ${occurrence.nodeId}, ${occurrence.split}`, exact: true });
    await occurrenceButton.click();
    const selectedNode = page.locator(`.tree-node[data-node-id="${occurrence.nodeId}"]`);
    await expect(selectedNode).toBeFocused();
    await occurrenceButton.click();
    await expect(selectedNode).toBeFocused();
    await page.waitForFunction(() => document.querySelector('.diagram-workspace')?.getAttribute('aria-busy') === 'false');
    expect(await page.locator('.tree-node').count()).toBe(analysis.treeFacts[occurrence.treeIndex].nodeCount);
    expect(await page.locator('.tree-node.is-leaf').count()).toBe(analysis.treeFacts[occurrence.treeIndex].leaves);
    await page.setViewportSize({ width: 390, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: /Open another/ }).click();
    await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
    await pageSession.send('HeapProfiler.collectGarbage');
    const mainHeapAfterCloseAndGC = await pageSession.send('Runtime.getHeapUsage');
    const remainingWorkers = (await browserSession.send('Target.getTargets')).targetInfos.filter(target => target.type === 'worker' && target.url.includes('/assets/model.worker-')).length;
    expect(remainingWorkers, 'closing disposes the model worker').toBe(0);
    await settle();
    const firstCloseTasks = await tasks();
    const repeatedCycles = [{
      cycle: 1, importMs, editMs,
      liveMainUsedBytes: Math.max(mainHeapAfterImport.usedSize, mainHeapAfterEdit.usedSize),
      closedMainUsedBytes: mainHeapAfterCloseAndGC.usedSize,
      maximumTaskMs: Math.max(0, ...importTasks, ...editorTasks, ...editTasks, ...firstCloseTasks),
      remainingWorkers,
    }];
    await page.setViewportSize({ width: 1280, height: 900 });
    for (let cycle = 2; cycle <= 5; cycle += 1) {
      await clearTasks();
      const cycleImportStart = Date.now();
      await page.locator('input[type=file]').setInputFiles(file!);
      await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
      await settle();
      const cycleImportMs = Date.now() - cycleImportStart;
      await page.getByRole('button', { name: 'Trace a profile' }).click();
      await page.getByText(/Edit illustrative profile/).click();
      await page.getByRole('searchbox', { name: 'Filter features' }).fill(condition.feature);
      const cycleInput = page.getByRole('textbox', { name: `Illustrative ${condition.feature}`, exact: true });
      const cycleInitial = Number(await cycleInput.inputValue());
      const cycleChanged = cycleInitial < threshold ? threshold : threshold - Math.max(1, Math.abs(threshold) * 0.000001);
      expect(Number.isFinite(cycleChanged) && cycleChanged !== cycleInitial).toBe(true);
      const cycleEditStart = Date.now();
      await cycleInput.fill(String(cycleChanged));
      await expect(page.getByRole('button', { name: `Inspect changed Tree ${targetIndex + 1}`, exact: true })).toBeVisible();
      await settle();
      const cycleEditMs = Date.now() - cycleEditStart;
      const liveHeap = await pageSession.send('Runtime.getHeapUsage');
      await page.getByRole('button', { name: /Open another/ }).click();
      await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
      await pageSession.send('HeapProfiler.collectGarbage');
      const closedHeap = await pageSession.send('Runtime.getHeapUsage');
      const workers = (await browserSession.send('Target.getTargets')).targetInfos.filter(target => target.type === 'worker' && target.url.includes('/assets/model.worker-')).length;
      await settle();
      repeatedCycles.push({
        cycle, importMs: cycleImportMs, editMs: cycleEditMs,
        liveMainUsedBytes: liveHeap.usedSize, closedMainUsedBytes: closedHeap.usedSize,
        maximumTaskMs: Math.max(0, ...await tasks()), remainingWorkers: workers,
      });
    }
    await page.reload();
    await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
    expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))).toEqual({ local: [], session: [] });
    await pageSession.send('HeapProfiler.collectGarbage');
    const mainHeapAfterReloadAndGC = await pageSession.send('Runtime.getHeapUsage');
    const evidence = {
      source: 'Owner-supplied production export; local/private run, not a scoring oracle',
      label, bytes, trees: parsed.model.trees.length, nodes: parsed.nodeCount, depthEdges: parsed.maxDepth,
      predictors: analysis.features.length, scoringStatus: parsed.model.scoringStatus,
      cpu: cpus()[0]?.model, browser: await page.evaluate(() => navigator.userAgent),
      importMs, importTasks, editorTasks, editMs, editTasks, workerTimings,
      memory: { unit: 'bytes', kind: 'V8 heap snapshots, not process RSS, peak memory or secure-erasure proof', memoryBefore, mainHeapAfterImport, workerHeapAfterImport, mainHeapAfterEdit, mainHeapAfterCloseAndGC, mainHeapAfterReloadAndGC },
      navigation: { occurrencePageOffset: occurrenceOffset, repeatedExactFocus: true, viewportWidth: 390 },
      remainingWorkersAfterClose: remainingWorkers,
      repeatedCycles,
      repeatedBudget: { cycles: 5, liveMainMiB: 128, closedAboveBaselineMiB: 64, warmGrowthMiB: 4, maximumTaskMs: 100 },
    };
    await writeFile(testInfo.outputPath(`private-${label.toLowerCase()}-evidence.json`), JSON.stringify(evidence, null, 2));
    for (const cycle of repeatedCycles) {
      expect(cycle.remainingWorkers, 'each authentic close terminates its worker').toBe(0);
      expect(cycle.liveMainUsedBytes, 'provisional authentic sampled-live heap budget').toBeLessThanOrEqual(128 * 1024 * 1024);
      expect(cycle.closedMainUsedBytes - memoryBefore.usedSize, 'provisional authentic closed-heap budget').toBeLessThanOrEqual(64 * 1024 * 1024);
      expect(cycle.maximumTaskMs, 'authentic repeated import/edit/close main-thread blocking').toBeLessThanOrEqual(100);
    }
    expect(Math.max(...repeatedCycles.slice(2).map(cycle => cycle.closedMainUsedBytes)) - repeatedCycles[1].closedMainUsedBytes,
      'authentic closed-heap growth after two warm-up cycles').toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(Math.max(0, ...importTasks), 'authentic import main-thread blocking').toBeLessThanOrEqual(100);
    expect(Math.max(0, ...editorTasks), 'authentic editor main-thread blocking').toBeLessThanOrEqual(100);
    expect(Math.max(0, ...editTasks), 'authentic changed-route edit main-thread blocking').toBeLessThanOrEqual(100);
    await pageSession.detach();
    await browserSession.detach();
  });
}
