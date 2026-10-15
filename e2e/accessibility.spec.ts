import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

for (const surface of ['start', 'explore', 'trace', 'ai-preview']) {
  test(`${surface} has no automated WCAG A/AA violations`, async ({ page }, testInfo) => {
    await page.goto('/');
    if (surface !== 'start') {
      await page.getByRole('button', { name: /Try the bundled sample/ }).click();
      await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
    }
    if (surface === 'trace' || surface === 'ai-preview') {
      await page.getByRole('button', { name: 'Trace a profile' }).click();
      await page.getByText(/Edit illustrative profile/).click();
    }
    if (surface === 'ai-preview') {
      await page.getByRole('checkbox', { name: /Enable optional whole-model/ }).check();
      await expect(page.getByTestId('model-explanation-prompt')).toBeVisible();
    }
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const report = testInfo.outputPath(`axe-${surface}.json`);
    await writeFile(report, JSON.stringify(result.violations, null, 2));
    await testInfo.attach(`axe-${surface}`, { path: report, contentType: 'application/json' });
    expect(result.violations, surface).toEqual([]);
  });
}

test('mobile occurrence selection reveals and focuses the matching SVG node', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Find a tree or predictor' }).click();
  await page.getByRole('searchbox', { name: 'Search predictors' }).fill('Customer.Age');
  await page.locator('.predictor-group summary').click();
  await page.getByRole('button', { name: /Tree 1, root.L.R, Customer.Age/ }).click();
  const node = page.locator('.tree-node[data-node-id="root.L.R"]');
  await expect(node).toBeFocused();
  const geometry = await node.evaluate(element => {
    const node = element.getBoundingClientRect();
    const viewport = document.querySelector('.diagram-canvas')!.getBoundingClientRect();
    return { visibleInMap: node.left >= viewport.left && node.right <= viewport.right && node.top >= viewport.top && node.bottom <= viewport.bottom, visibleOnScreen: node.top >= 0 && node.bottom <= innerHeight };
  });
  expect(geometry).toEqual({ visibleInMap: true, visibleOnScreen: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('region', { name: 'Tree text outline' })).toBeVisible();
  await page.getByRole('button', { name: 'Root', exact: true }).click();
  await page.getByRole('button', { name: 'Find a tree or predictor' }).click();
  await page.getByRole('button', { name: /Tree 1, root.L.R, Customer.Age/ }).click();
  await expect(node).toHaveAttribute('aria-pressed', 'true');
  await expect(node).toBeFocused();
});

test('complete tree stays expanded by default through fit, manual collapse and subtree focus', async ({ page }) => {
  const leaf = { score: 0.1, sampleCount: 1 };
  type Node = typeof leaf & { split?: string; left?: Node; right?: Node };
  const split = (left: Node, right: Node): Node => ({ score: 0, sampleCount: left.sampleCount + right.sampleCount, split: 'Age < 1', left, right });
  const twoLeaves = () => split(leaf, leaf);
  const fourLeaves = () => split(twoLeaves(), twoLeaves());
  const tree = split(split(leaf, split(fourLeaves(), leaf)), split(split(fourLeaves(), twoLeaves()), split(fourLeaves(), leaf)));
  const exported = { type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST', model: { booster: { trees: [tree] } } };
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-33-nodes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Root', exact: true }).click();
  await expect(page.locator('.tree-facts > div').nth(0).locator('b')).toHaveText('33');
  await expect(page.locator('.tree-facts > div').nth(1).locator('b')).toHaveText('17');
  const count = page.locator('.diagram-count');
  await expect(count).toHaveText('33 of 33 nodes shown; 17 of 17 leaves shown');
  await expect(page.locator('.tree-node')).toHaveCount(33);
  await expect(page.locator('.tree-node.is-leaf')).toHaveCount(17);
  await expect(page.getByText(/All nodes and leaves are shown/)).toBeVisible();
  await page.locator('.tree-node[data-node-id="root.L.R.L"]').click();
  await page.getByRole('button', { name: 'Collapse descendants', exact: true }).click();
  await expect(count).toHaveText('27 of 33 nodes shown; 13 of 17 leaves shown');
  await page.getByRole('button', { name: 'Expand descendants', exact: true }).click();
  await expect(count).toHaveText('33 of 33 nodes shown; 17 of 17 leaves shown');
  await page.getByRole('button', { name: 'Fit tree', exact: true }).click();
  await expect(count).toHaveText('33 of 33 nodes shown; 17 of 17 leaves shown');
  expect(await page.locator('.tree-svg').evaluate(element => {
    const drawing = element.getBoundingClientRect();
    const viewport = element.parentElement!.getBoundingClientRect();
    return drawing.width <= viewport.width && drawing.height <= viewport.height;
  })).toBe(true);
  await page.getByRole('button', { name: 'Focus this subtree', exact: true }).click();
  await expect(count).toHaveText('7 of 33 nodes shown; 4 of 17 leaves shown');
  await expect(page.getByText(/outside the focused subtree/)).toBeVisible();
  await page.getByRole('button', { name: 'Root', exact: true }).click();
  await expect(count).toHaveText('33 of 33 nodes shown; 17 of 17 leaves shown');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
