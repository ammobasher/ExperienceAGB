import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function exported(time = '2024-01-01T00:00:00.000Z', later = false) {
  const leaf = (score: number) => ({ score, sampleCount: 0 });
  return {
    type: 'AdaptiveBoostScoringModel', algorithm: 'GRADIENT_BOOST', modelVersion: '2', factoryUpdateTime: time,
    model: { booster: { trees: [
      { score: 0, sampleCount: 0, gain: .00001, split: 'Param.Score is Missing', left: leaf(-.1), right: leaf(.2) },
      { score: 0, sampleCount: 0, gain: later ? .00004 : .00002, split: `IH.Web.Clicked.Recency < ${later ? 4 : 2}`, left: leaf(-.2), right: leaf(.1) },
      { score: 0, sampleCount: 0, gain: .00003, split: later ? 'Customer.Product in { 12, C }' : 'Customer.Product in { "A,B", 12 }', left: leaf(0), right: leaf(.3) },
    ] } },
  };
}
const file = (name: string, value: object) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
async function open(page: Page) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(file('synthetic-audit.json', exported()));
  await expect(page.getByRole('heading', { name: 'synthetic-audit.json', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Model insights', exact: true }).click();
}
async function axe(page: Page, path: string) {
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations;
  await writeFile(path, JSON.stringify(violations, null, 2));
  expect(violations).toEqual([]);
}

for (const mobile of [false, true]) {
  test(`local audit charts, linked navigation and accessible evidence (${mobile ? 'mobile' : 'desktop'})`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const writes: string[] = [], errors: string[] = [];
    page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await open(page);
    const audit = page.getByRole('region', { name: 'Local model insights', exact: true });
    await expect(audit.getByRole('heading', { name: 'Understand this model' })).toBeFocused();
    await expect(audit).toContainText('3 trees, 9 nodes and 6 leaves');
    await expect(audit.getByRole('heading', { name: 'Explicit missing checks', exact: true }).locator('..')).toContainText('1');
    await audit.getByRole('button', { name: 'Predictors', exact: true }).click();
    const predictors = audit.getByRole('table', { name: /Exact predictor evidence across/ });
    await expect(predictors.getByRole('row', { name: /Param.Score/ })).toContainText('Param');
    await expect(predictors.getByRole('row', { name: /Param.Score/ })).toContainText('provenance unverified');
    await axe(page, testInfo.outputPath('axe-audit-predictors.json'));
    await page.screenshot({ path: testInfo.outputPath('audit-predictors.png'), fullPage: true });
    await predictors.getByRole('button', { name: 'Param.Score', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tree 1', exact: true })).toBeVisible();
    if (mobile) await page.getByRole('button', { name: 'Find a tree or predictor', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: 'Search predictors' })).toHaveValue('Param.Score');
    await page.getByRole('button', { name: 'Model insights', exact: true }).click();
    await audit.getByRole('button', { name: 'Tree diagnostics', exact: true }).click();
    await audit.getByRole('button', { name: /Explore Tree 2:/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Tree 2', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Model insights', exact: true }).click();
    await audit.getByRole('button', { name: 'History & context', exact: true }).click();
    const histogram = audit.getByRole('table', { name: 'Exact threshold histogram: IH.Web.Clicked.Recency', exact: true });
    await expect(histogram.locator('tbody tr')).toHaveCount(1);
    await expect(histogram.locator('tbody tr').first()).toHaveText('221');
    await expect(audit).toContainText('All 6 leaves contribute');
    await expect(audit.getByRole('table', { name: 'Numeric, membership and missing-check inventory (3 matches)', exact: true }).getByRole('row', { name: /Customer.Product/ })).toContainText('1 / 2');
    await axe(page, testInfo.outputPath('axe-audit-history.json'));
    await page.screenshot({ path: testInfo.outputPath('audit-history.png'), fullPage: true });
    await audit.getByRole('button', { name: 'Review findings', exact: true }).click();
    await expect(audit).toContainText('not ranked faults');
    await expect(audit).toContainText('2 distinct observed values');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('audit.png'), fullPage: true });
    await expect(page.getByRole('region', { name: 'Model AI explanation', exact: true })).toHaveCount(1);
    expect(await audit.evaluate(element => !!(element.compareDocumentPosition(document.querySelector('.contextual-ai')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('worker-built audit downloads retain exact evidence, hashes and offline responsive HTML without scripts', async ({ page, context }, testInfo) => {
  await open(page);
  const audit = page.getByRole('region', { name: 'Local model insights', exact: true });
  await expect(audit.getByRole('button', { name: 'Prepare audit HTML' })).toBeDisabled();
  await audit.getByRole('checkbox', { name: 'I approve preparing a sensitive local audit download.' }).check();
  await audit.getByRole('button', { name: 'Prepare evidence bundle JSON' }).click();
  await expect(audit.getByRole('checkbox')).not.toBeChecked();
  const jsonDownload = page.waitForEvent('download');
  await audit.getByRole('link', { name: 'Save prepared audit JSON', exact: true }).click();
  const savedJSON = testInfo.outputPath('audit-bundle.json');
  await (await jsonDownload).saveAs(savedJSON);
  const bundle = JSON.parse(await readFile(savedJSON, 'utf8'));
  expect(bundle.manifest.source.digest).toBe(createHash('sha256').update(JSON.stringify(exported())).digest('hex'));
  expect(bundle.manifest.evidence.structure.missingChecks).toBe(1);
  expect(bundle.manifest.evidence.structure.unparsedSplits).toBe(0);
  expect(bundle.manifest.analysis.predictors.find((row: { feature: string }) => row.feature === 'Customer.Product').categoryDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(bundle.figures.treeOrder).toHaveLength(3);
  expect(bundle.files['predictors.csv']).toContain('Param.Score');
  expect(bundle.manifest.analysis.trees[0]).not.toHaveProperty('left');
  await audit.getByRole('checkbox').check();
  await audit.getByRole('button', { name: 'Prepare audit HTML', exact: true }).click();
  const htmlDownload = page.waitForEvent('download');
  await audit.getByRole('link', { name: 'Save prepared audit HTML', exact: true }).click();
  const savedHTML = testInfo.outputPath('audit-report.html');
  await (await htmlDownload).saveAs(savedHTML);
  const offline = await context.newPage(), external: string[] = [];
  await offline.route(/^https?:/, route => { external.push(route.request().url()); return route.abort(); });
  try {
    await offline.setViewportSize({ width: 390, height: 844 });
    await offline.goto(pathToFileURL(savedHTML).href);
    await expect(offline.getByRole('heading', { name: 'Local structural audit', exact: true })).toBeVisible();
    await expect(offline.locator('script')).toHaveCount(0);
    expect(await offline.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await axe(offline, testInfo.outputPath('axe-offline-audit.json'));
    expect(external).toEqual([]);
  } finally { await offline.close(); }
});

test('real snapshot workers compare gain shares, threshold distributions and equal-cardinality category changes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare model snapshots', exact: true }).click();
  await page.getByRole('checkbox', { name: /I confirm these snapshots/ }).check();
  await page.getByLabel('Snapshot export files', { exact: true }).setInputFiles([
    file('later.json', exported('2024-02-01T00:00:00.000Z', true)),
    file('earlier.json', exported()),
  ]);
  await expect(page.locator('.model-evolution').getByRole('status')).toContainText('2 added');
  await expect(page.getByRole('table', { name: 'Changed or unverifiable membership summaries (1)', exact: true })).toContainText('Different observed sets');
  await expect(page.getByRole('table', { name: 'Changed numeric threshold summaries (1)', exact: true })).toContainText('IH.Web.Clicked.Recency');
  await expect(page.getByRole('table', { name: 'Shared predictor gain-share changes', exact: true }).locator('tbody tr')).toHaveCount(3);
  await expect(page.getByRole('region', { name: 'Stored gain over time', exact: true }).locator('circle')).toHaveCount(2);
  await expect(page.getByRole('table', { name: 'Literal namespace gain composition', exact: true })).toContainText('Param');
});

test('duplicate JSON fields fail visibly without opening a model or making a provider request', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'ambiguous.json', mimeType: 'application/json', buffer: Buffer.from('{"auc":0.1,"auc":0.9}') });
  await expect(page.getByRole('alert')).toContainText('Duplicate object keys');
  await expect(page.getByRole('region', { name: 'Model workspace', exact: true })).toHaveCount(0);
});
