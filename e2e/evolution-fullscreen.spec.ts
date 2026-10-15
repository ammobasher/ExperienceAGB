import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { observePerformance, readPerformance } from './performanceHarness';

test.use({ timezoneId: 'America/New_York' });
function snapshot(name: string, time?: string, treeCount = 1, feature = 'Age', metadata: Record<string, unknown> = {}) {
  const tree = { score: 0, sampleCount: 2, split: `${feature} < 35`, left: { score: -.1, sampleCount: 1 }, right: { score: .2, sampleCount: 1 } };
  return {
    name, mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST',
      factoryUpdateTime: time, model: { booster: { trees: Array.from({ length: treeCount }, () => tree) } }, ...metadata,
    })),
  };
}
async function openComparison(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare model snapshots', exact: true }).click();
  await page.getByRole('checkbox', { name: /I confirm these snapshots/ }).check();
}
async function axe(page: Page, path: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await writeFile(path, JSON.stringify(result.violations, null, 2));
  expect(result.violations).toEqual([]);
}

for (const mobile of [false, true]) {
  test(`native diagram fullscreen preserves the complete scope, selection and camera (${mobile ? 'mobile' : 'desktop'})`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    function tree(depth: number): object {
      return depth ? { score: 0, sampleCount: 2 ** depth, split: `Age < ${depth}`, left: tree(depth - 1), right: tree(depth - 1) } : { score: .1, sampleCount: 1 };
    }
    const exported = { type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST', model: { booster: { trees: [tree(8)] } } };
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-fullscreen.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await page.waitForFunction(() => document.querySelector('.diagram-workspace')?.getAttribute('aria-busy') === 'false');
    await page.getByRole('button', { name: 'Root', exact: true }).click();
    await expect(page.locator('.tree-node')).toHaveCount(511);
    await page.getByRole('button', { name: 'Collapse descendants', exact: true }).click();
    await page.locator('.tree-svg').evaluate(element => element.setAttribute('data-preserved-drawing', 'yes'));
    await page.getByRole('button', { name: 'Enter diagram fullscreen', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Tree 1 diagram fullscreen' })).toBeVisible();
    expect(await page.evaluate(() => document.fullscreenElement === document.querySelector('.diagram-workspace'))).toBe(true);
    await expect(page.getByRole('button', { name: 'Exit diagram fullscreen', exact: true })).toBeFocused();
    await expect(page.locator('.diagram-count')).toHaveText('1 of 511 nodes shown; 0 of 256 leaves shown');
    await expect(page.locator('.tree-svg')).toHaveAttribute('data-preserved-drawing', 'yes');
    await page.getByRole('button', { name: 'Expand descendants', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.diagram-workspace')?.getAttribute('aria-busy') === 'false');
    await expect(page.locator('.tree-node')).toHaveCount(511);
    await page.getByRole('button', { name: 'Fit tree', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom out', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.tree-outline button').last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeFocused();
    expect(await page.locator('.diagram-canvas').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.width >= 250 && rect.height >= 180 && rect.right <= innerWidth + 1;
    })).toBe(true);
    await axe(page, testInfo.outputPath('axe-fullscreen.json'));
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'Reveal selected node', exact: true }).click();
    await page.locator('.diagram-details-panel').evaluate(element => element.scrollTop = 0);
    const zoom = await page.locator('.zoom-control > span').innerText();
    await page.screenshot({ path: testInfo.outputPath('fullscreen.png') });
    if (mobile) await page.getByRole('button', { name: 'Exit diagram fullscreen', exact: true }).click();
    else await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await expect(page.getByRole('button', { name: 'Enter diagram fullscreen', exact: true })).toBeFocused();
    await expect(page.locator('.zoom-control > span')).toHaveText(zoom);
    await expect(page.locator('.diagram-count')).toHaveText('511 of 511 nodes shown; 256 of 256 leaves shown');
    await expect(page.locator('.tree-svg')).toHaveAttribute('data-preserved-drawing', 'yes');
  });
}

test('real summary-only workers compare unordered exports, missing values and predictor changes locally', async ({ page, browser }, testInfo) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await observePerformance(page);
  await openComparison(page);
  const early = snapshot('early.json', '2024-01-01T00:00:00.000Z', 1, 'Age', { auc: .6, successRate: .1, trainingStats: { positiveCount: 10, negativeCount: 90, totalCount: 100 } });
  const middle = snapshot('middle.json', '2024-01-02T00:00:00.000Z', 2, 'Age');
  const late = snapshot('late.json', '2024-01-10T00:00:00.000Z', 3, 'Country', { auc: .9, successRate: .15, trainingStats: { positiveCount: 30, negativeCount: 170, totalCount: 200 } });
  await page.getByLabel('Snapshot export files', { exact: true }).setInputFiles([
    late, early, middle, { ...early, name: 'exact-copy.json' },
    snapshot('undated.json'), { name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') },
  ]);
  await expect(page.locator('.model-evolution').getByRole('status')).toHaveText('Import complete: 4 added, 1 exact duplicates skipped, 1 rejected.');
  await expect(page.getByText(/4 snapshots retained; 3 dated; 1 excluded/)).toBeVisible();
  const rows = page.getByRole('table', { name: 'Exact metrics for all retained snapshots', exact: true }).locator('tbody tr');
  await expect(rows.nth(0)).toContainText('early.json');
  await expect(rows.nth(1)).toContainText('middle.json');
  await expect(rows.nth(2)).toContainText('late.json');
  await expect(rows.nth(3)).toContainText('undated.json');
  const structure = page.getByRole('region', { name: 'Structure over time', exact: true });
  await structure.getByRole('combobox').selectOption('nodes');
  const points = await structure.locator('circle').evaluateAll(elements => elements.map(element => Number(element.getAttribute('cx'))));
  expect(points).toHaveLength(3);
  expect(points[0]).toBe(72); expect(points[2]).toBe(460);
  expect(points[1]).toBeCloseTo(72 + 388 / 9, 5);
  const evaluation = page.getByRole('region', { name: 'Exported evaluation metrics', exact: true });
  await expect(evaluation.locator('path.trend-line')).toHaveCount(2);
  expect(await evaluation.locator('path.trend-line').evaluateAll(elements => elements.every(element => !element.getAttribute('d')?.includes('L')))).toBe(true);
  await expect(page.getByRole('region', { name: 'Evolution insights', exact: true })).toContainText('+5.00 percentage points');
  await page.getByText('Added predictors (1)', { exact: true }).click();
  await page.getByText('Removed predictors (1)', { exact: true }).click();
  await expect(page.locator('.predictor-changes').nth(0)).toContainText('Country');
  await expect(page.locator('.predictor-changes').nth(1)).toContainText('Age');
  const evidence = await readPerformance(page);
  expect(evidence.transfers.filter(message => message.kind === 'evolution-summary')).toHaveLength(5);
  expect(evidence.transfers.filter(message => message.kind === 'nodes' || message.kind === 'metadata')).toHaveLength(0);
  const targets = await browser.newBrowserCDPSession();
  try {
    await expect.poll(async () => (await targets.send('Target.getTargets')).targetInfos.filter(target => target.type === 'worker').length).toBe(0);
  } finally { await targets.detach(); }
  await axe(page, testInfo.outputPath('axe-evolution.json'));
  await page.screenshot({ path: testInfo.outputPath('evolution-desktop.png'), fullPage: true });
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []]);
  await page.reload();
  await page.getByRole('button', { name: 'Compare model snapshots', exact: true }).click();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('mobile UTC correction rejects missing dates, pauses duplicate times and restores export provenance', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openComparison(page);
  await page.getByLabel('Snapshot export files', { exact: true }).setInputFiles([snapshot('dated.json', '2024-01-01T00:00:00.000Z'), snapshot('unknown.json')]);
  await expect(page.locator('.model-evolution').getByRole('status')).toContainText('2 added');
  const membership = page.getByRole('table', { name: 'Imported snapshot dates, provenance and membership', exact: true });
  const row = membership.getByRole('row', { name: /unknown.json/ });
  const time = row.getByLabel('UTC time for unknown.json', { exact: true });
  await row.getByRole('button', { name: 'Apply UTC time', exact: true }).click();
  await expect(time).toHaveAttribute('aria-invalid', 'true');
  await expect(row.getByRole('alert')).toHaveText(/Enter a valid UTC/);
  await time.fill('2024-01-01T00:00');
  await row.getByRole('button', { name: 'Apply UTC time', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('same UTC time');
  await expect(page.getByRole('img')).toHaveCount(0);
  await time.fill('2024-01-02T00:00:00.123');
  await row.getByRole('button', { name: 'Apply UTC time', exact: true }).click();
  await expect(row.locator('time')).toHaveText('2024-01-02T00:00:00.123Z');
  await expect(row).toContainText('(manual)');
  await expect(page.getByRole('region', { name: 'Evolution insights', exact: true })).toBeVisible();
  await axe(page, testInfo.outputPath('axe-mobile-evolution.json'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('evolution-mobile.png'), fullPage: true });
  const dated = membership.getByRole('row', { name: /dated.json/ });
  await dated.getByLabel('UTC time for dated.json', { exact: true }).fill('2024-01-03T00:00');
  await dated.getByRole('button', { name: 'Apply UTC time', exact: true }).click();
  await dated.getByRole('button', { name: 'Restore export time', exact: true }).click();
  await expect(dated.locator('time')).toHaveText('2024-01-01T00:00:00.000Z');
  await row.getByRole('button', { name: 'Remove unknown.json', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Evolution insights', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear comparison', exact: true }).click();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /I confirm these snapshots/ })).not.toBeChecked();
});

test('cancelling a held real snapshot worker preserves completed summaries, terminates it and permits retry', async ({ page, browser }) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    let imports = 0;
    window.Worker = class extends OriginalWorker {
      postMessage(message: unknown) {
        if ((message as { kind?: string }).kind === 'evolution-import' && ++imports === 2) return;
        super.postMessage(message);
      }
    };
  });
  await openComparison(page);
  const files = [snapshot('first.json', '2024-01-01T00:00:00.000Z'), snapshot('second.json', '2024-01-02T00:00:00.000Z'), snapshot('third.json', '2024-01-03T00:00:00.000Z')];
  const targets = await browser.newBrowserCDPSession();
  const workers = async () => (await targets.send('Target.getTargets')).targetInfos.filter(target => target.type === 'worker').length;
  try {
    await page.getByLabel('Snapshot export files', { exact: true }).setInputFiles(files);
    await expect(page.locator('.model-evolution').getByRole('status')).toContainText('2 of 3');
    await expect.poll(workers).toBe(1);
    await page.getByRole('button', { name: 'Cancel snapshot import', exact: true }).click();
    await expect(page.locator('.model-evolution').getByRole('status')).toContainText('Cancelled. Kept 1 newly imported snapshots');
    await expect.poll(workers).toBe(0);
    await expect(page.getByRole('table', { name: 'Exact metrics for all retained snapshots', exact: true }).locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Snapshot export files', { exact: true }).setInputFiles(files[1]);
    await expect(page.locator('.model-evolution').getByRole('status')).toContainText('1 added');
    await expect(page.getByRole('region', { name: 'Evolution insights', exact: true })).toBeVisible();
    await expect.poll(workers).toBe(0);
  } finally { await targets.detach(); }
});

test('workspace evolution preserves tree/profile state, the live occurrence worker and the single bottom AI panel', async ({ page, browser }, testInfo) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(snapshot('open-model.json', '2024-01-01T00:00:00.000Z', 130));
  const metrics = page.getByLabel('Model structure summary', { exact: true });
  await metrics.locator('summary').filter({ hasText: 'Nodes across all trees' }).click();
  await expect(metrics.getByText(/summed across every tree in this export/)).toBeVisible();
  await page.getByText('Technical terms and metric scopes', { exact: true }).click();
  await expect(page.locator('.technical-terms').getByText('Ensemble / model', { exact: true })).toBeVisible();
  await axe(page, testInfo.outputPath('axe-expanded-terms.json'));
  await page.getByText('Technical terms and metric scopes', { exact: true }).click();
  await page.getByRole('button', { name: 'Trace a profile', exact: true }).click();
  await page.locator('.profile-editor summary').click();
  await page.getByRole('textbox', { name: 'Illustrative Age', exact: true }).fill('10');
  await page.getByRole('checkbox', { name: /Enable optional whole-model/ }).check();
  await page.getByRole('button', { name: 'Model evolution', exact: true }).click();
  await page.getByRole('checkbox', { name: /I confirm these snapshots/ }).check();
  await page.getByLabel('Snapshot export files', { exact: true }).setInputFiles([snapshot('one.json', '2024-01-01T00:00:00.000Z'), snapshot('two.json', '2024-01-02T00:00:00.000Z', 2)]);
  await expect(page.locator('.model-evolution').getByRole('status')).toContainText('2 added');
  await page.getByRole('button', { name: 'Trace a profile', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Illustrative Age', exact: true })).toHaveValue('10');
  await expect(page.getByRole('checkbox', { name: /Enable optional whole-model/ })).toBeChecked();
  await page.getByRole('button', { name: 'Explore trees', exact: true }).click();
  await page.locator('.predictor-group summary').click();
  await page.getByRole('button', { name: 'Next splits', exact: true }).click();
  await page.getByRole('button', { name: 'Tree 21, root, Age < 35', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tree 21', exact: true })).toBeVisible();
  const targets = await browser.newBrowserCDPSession();
  try {
    expect((await targets.send('Target.getTargets')).targetInfos.filter(target => target.type === 'worker').length).toBe(1);
  } finally { await targets.detach(); }
  await page.getByRole('button', { name: 'Model evolution', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Exact metrics for all retained snapshots', exact: true }).locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.contextual-ai')).toHaveCount(1);
  expect(await page.locator('.workspace').evaluate(element => element.lastElementChild?.classList.contains('contextual-ai'))).toBe(true);
  expect(writes).toEqual([]);
});

test('identical unchanged exports can be explicitly kept at distinct manual observation times', async ({ page }) => {
  await openComparison(page);
  const first = snapshot('unchanged-first.json');
  await page.getByLabel('Snapshot export files', { exact: true }).setInputFiles([first, { ...first, name: 'unchanged-later.json' }]);
  await expect(page.locator('.model-evolution').getByRole('status')).toContainText('1 added, 1 exact duplicates skipped');
  await page.getByRole('button', { name: 'Keep as separate snapshot', exact: true }).click();
  await expect(page.getByText(/2 snapshots retained; 0 dated; 2 excluded/)).toBeVisible();
  const membership = page.getByRole('table', { name: 'Imported snapshot dates, provenance and membership', exact: true });
  for (const [name, time] of [['unchanged-first.json', '2024-01-01T00:00'], ['unchanged-later.json', '2024-01-02T00:00']]) {
    const row = membership.getByRole('row', { name: new RegExp(name.replace('.', '\\.')) });
    await row.getByLabel(`UTC time for ${name}`, { exact: true }).fill(time);
    await row.getByRole('button', { name: 'Apply UTC time', exact: true }).click();
  }
  await expect(page.getByRole('region', { name: 'Evolution insights', exact: true })).toBeVisible();
  const structure = page.getByRole('region', { name: 'Structure over time', exact: true });
  expect(await structure.locator('circle').evaluateAll(elements => elements.map(element => element.getAttribute('cy')))).toEqual(['24', '24']);
  await expect(structure.locator('path.trend-line')).toHaveAttribute('d', 'M72,24 L460,24');
  await expect(page.getByRole('region', { name: 'Evolution insights', exact: true }).getByRole('row', { name: 'Trees in ensemble 1 1 +0', exact: true })).toBeVisible();
});
