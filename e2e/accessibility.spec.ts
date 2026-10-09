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
      await page.getByRole('checkbox', { name: /Enable session-only AI preview/ }).check();
      await page.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('github-models');
      await page.getByRole('textbox', { name: /Model identifier/ }).fill('example/model');
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
