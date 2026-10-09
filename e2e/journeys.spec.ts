import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const model = {
  type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST',
  factoryUpdateTime: '20240101T120000.000Z',
  model: { booster: { trees: [
    { score: 0, sampleCount: 2, split: 'Age < 35', left: { score: -0.1, sampleCount: 1 }, right: { score: 0.2, sampleCount: 1 } },
    { score: 0, sampleCount: 2, split: 'Channel in [Web, Store]', left: { score: 0.1, sampleCount: 1 }, right: { score: -0.1, sampleCount: 1 } },
  ] } },
};

test('predictor selection reveals its ensemble row with a matching or excluding tree filter', async ({ page }) => {
  const trees = Array.from({ length: 51 }, (_, index) => ({
    ...model.model.booster.trees[0],
    split: index === 29 ? 'ChosenFeature < 35' : 'Age < 35',
  }));
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({
    name: 'navigation.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...model, model: { booster: { trees } } })),
  });
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  const sidebar = page.getByRole('complementary', { name: 'Ensemble and predictor search' });
  await sidebar.locator('summary').filter({ hasText: 'ChosenFeature' }).click();
  for (const [search, expected] of [['Tree 3', 'Tree 3'], ['Tree 1', '']]) {
    await page.getByRole('searchbox', { name: 'Search trees' }).fill(search);
    await sidebar.getByRole('button', { name: 'Tree 30, root, ChosenFeature < 35', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tree 30', exact: true })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search trees' })).toHaveValue(expected);
    await expect(sidebar.getByRole('button', { name: '30 Tree 30 2 leaves', exact: true })).toHaveAttribute('aria-current', 'true');
    expect(await sidebar.locator('.tree-row').count()).toBeLessThanOrEqual(25);
    await expect(page.locator('.tree-node[data-node-id="root"]')).toBeFocused();
  }
});

test('upload, unknown/missing/invalid values, global blockers and repeated field focus', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'preview.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(model)) });
  await expect(page.getByRole('heading', { name: 'preview.json' })).toBeFocused();
  await page.getByRole('button', { name: 'Trace a profile' }).click();
  await expect(page.getByText('Unverified propensity preview', { exact: true })).toBeVisible();
  await expect(page.getByText('Final propensity', { exact: true })).toHaveCount(0);
  await page.getByText(/Edit illustrative profile/).click();
  await page.getByRole('textbox', { name: 'Illustrative Age', exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Inspect incomplete Tree 1: Age' })).toBeVisible();
  await page.getByRole('button', { name: /Next tree/ }).click();
  await expect(page.locator('.stage-preview-title')).toContainText('LEAF REACHED');
  await expect(page.locator('.ensemble-score')).toContainText('Incomplete routes');
  const edit = page.getByRole('button', { name: 'Edit blocked feature Age', exact: true });
  await edit.click();
  const age = page.getByRole('textbox', { name: 'Illustrative Age', exact: true });
  await expect(age).toBeFocused();
  await edit.click(); await expect(age).toBeFocused();
  await age.fill('0x20'); await expect(page.getByText('Invalid number', { exact: true })).toBeVisible();
  await age.fill('34'); await expect(page.locator('.ensemble-score')).not.toContainText('Incomplete routes');
  await page.getByRole('searchbox', { name: 'Filter features' }).fill('Channel');
  await page.getByRole('combobox', { name: 'Illustrative Channel', exact: true }).fill('Unseen');
  await expect(page.getByText('Unknown category', { exact: true })).toBeVisible();
  await expect(page.locator('.ensemble-score')).toContainText('Incomplete routes');
  await page.getByRole('button', { name: 'Reset values' }).click();
  await expect(page.locator('.ensemble-score')).not.toContainText('Incomplete routes');
  await page.getByText(/Ensemble route status/).click();
  await page.getByRole('button', { name: 'Inspect Tree 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tree 1', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
  expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))).toEqual({ local: [], session: [] });
});

test('rejects adverse imports with full diagnostics and recovers without a blank screen', async ({ page }) => {
  await page.goto('/');
  const cases = [
    { name: 'broken.json', text: '{', message: 'not valid JSON' },
    { name: 'notes.txt', text: '{}', message: '.json extension' },
    { name: 'future.json', text: JSON.stringify({ ...model, modelVersion: '999' }), message: 'Only the observed sample tag' },
    { name: 'calibration.json', text: JSON.stringify({ ...model, model: { booster: { ...model.model.booster, calibration: { offset: 100 } } } }), message: 'Unrecognized field' },
    { name: 'split-type.json', text: JSON.stringify({ ...model, model: { booster: { trees: [{ score: 0.75, sampleCount: 1, split: 42 }] } } }), message: 'nonempty string' },
    { name: 'category.json', text: JSON.stringify({ ...model, model: { booster: { trees: [{ ...model.model.booster.trees[1], split: 'Channel in ["Web,Store]' }] } } }), message: 'malformed condition' },
  ];
  for (const item of cases) {
    await page.locator('input[type=file]').setInputFiles({ name: item.name, mimeType: 'application/json', buffer: Buffer.from(item.text) });
    await expect(page.getByRole('alert')).toContainText(item.message);
    await expect(page.getByRole('heading', { name: 'Choose an export file' })).toBeVisible();
  }
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
});

test('oversized uploads are rejected before analysis', async ({ page }, testInfo) => {
  const file = testInfo.outputPath('oversized.json');
  await writeFile(file, Buffer.alloc(25 * 1024 * 1024 + 1, 32));
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('alert')).toContainText('25 MB limit');
  await expect(page.getByRole('button', { name: /Browse files/ })).toBeEnabled();
});

test('sample network failure, worker failure and abort-signal cancellation surface recovery', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes('/sample/') || !Reflect.get(window, 'holdSampleForCancellation')) return nativeFetch(input, init);
      const signal = init?.signal;
      if (!signal) return Promise.reject(new Error('Cancellation fixture requires an AbortSignal.'));
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException('Cancelled test fetch', 'AbortError'));
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
      });
    };
  });
  await page.route('**/sample/*.json', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('alert')).toContainText('bundled sample could not be loaded');
  await page.unroute('**/sample/*.json');
  await page.route('**/assets/model.worker-*', route => route.abort());
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('alert')).toContainText('analysis worker failed');
  await page.unroute('**/assets/model.worker-*');
  await page.evaluate(() => Reflect.set(window, 'holdSampleForCancellation', true));
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await page.getByRole('button', { name: 'Cancel import' }).click();
  await expect(page.getByRole('alert')).toContainText('Import cancelled');
  await page.evaluate(() => Reflect.set(window, 'holdSampleForCancellation', false));
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
});

test('native worker messageerror rejects import and allows retry', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    let injectFailure = true;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (injectFailure) {
          injectFailure = false;
          queueMicrotask(() => this.dispatchEvent(new MessageEvent('messageerror')));
        }
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('alert')).toContainText('worker response could not be read');
  await expect(page.getByRole('region', { name: 'Model workspace' })).toHaveCount(0);
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
});

for (const width of [320, 390, 768, 1440]) {
  test(`complete keyboard/viewport smoke journey at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /Try the bundled sample/ }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
    if (width <= 800) await page.getByRole('button', { name: 'Find a tree or predictor' }).click();
    await page.getByRole('searchbox', { name: 'Search trees' }).fill('Tree 2');
    await page.getByRole('button', { name: /02 Tree 2/ }).click();
    await expect(page.getByRole('heading', { name: 'Tree 2', exact: true })).toBeVisible();
    await expect(page.locator('.tree-node[data-node-id="root"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Selected node details' })).toContainText('SPLIT NODE');
    await page.getByRole('button', { name: 'Trace a profile' }).click();
    await page.getByText(/Edit illustrative profile/).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  });
}
