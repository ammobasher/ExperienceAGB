import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

async function inspect(page: Page, testInfo: TestInfo, name: string) {
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations;
  await writeFile(testInfo.outputPath(`axe-${name}.json`), JSON.stringify(violations, null, 2));
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no page-level horizontal overflow`).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

for (const mobile of [false, true]) {
  test(`readable modes, evidence and charts without cloud requests (${mobile ? 'mobile' : 'desktop'})`, async ({ page }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const writes: string[] = [], errors: string[] = [];
    page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await inspect(page, testInfo, 'start');
    await page.getByRole('button', { name: /Try the bundled sample/ }).click();
    await expect(page.getByRole('heading', { name: 'Follow a tree, one question at a time', exact: true })).toBeVisible();
    expect(await page.locator('.workspace-tasks').evaluate(element => ({
      display: getComputedStyle(element).display,
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
    }))).toEqual({ display: 'grid', columns: mobile ? 2 : 4 });
    await expect(page.getByLabel('Diagram color key')).toContainText('Question (split)');
    await expect(page.locator('[data-node-id="root.L"] .tree-node-second-line')).toHaveText('< 3');
    await inspect(page, testInfo, 'explore');
    await page.getByRole('button', { name: 'Trace a profile', exact: true }).click();
    await page.getByText('Edit illustrative profile', { exact: false }).click();
    await inspect(page, testInfo, 'trace');
    await page.getByRole('button', { name: 'Model insights', exact: true }).click();
    const audit = page.getByRole('region', { name: 'Local model insights', exact: true });
    const success = audit.getByRole('heading', { name: 'Exported success rate', exact: true }).locator('..');
    await expect(success).toContainText('8.42%');
    await expect(success).toContainText('From the export');
    await inspect(page, testInfo, 'overview');
    await audit.getByRole('button', { name: 'Predictors', exact: true }).click();
    const table = audit.getByRole('table', { name: /Exact predictor evidence across/ });
    await table.locator('tbody tr').first().getByText('Exact numbers', { exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(table.locator('tbody tr').first().locator('.exact-numbers')).toHaveAttribute('open', '');
    await inspect(page, testInfo, 'predictors');
    await audit.getByRole('button', { name: 'History & context', exact: true }).click();
    await expect(audit).toContainText('None of these directions means');
    await inspect(page, testInfo, 'history');
    await page.getByRole('button', { name: 'Model evolution', exact: true }).click();
    const evolution = page.getByRole('region', { name: 'Model evolution', exact: true });
    await expect(evolution.getByRole('heading', { name: 'Start with two snapshots', exact: true })).toBeVisible();
    await evolution.getByRole('checkbox', { name: /I confirm these snapshots/ }).check();
    await page.getByLabel('Snapshot export files', { exact: true }).setInputFiles([1, 2].map(day => ({
      name: `visual-day-${day}.json`, mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        type: 'AdaptiveBoostScoringModel', algorithm: 'GRADIENT_BOOST', modelVersion: '2',
        factoryUpdateTime: `2024-01-0${day}T00:00:00.000Z`, successRate: .0842 + day * .01, auc: .7 + day * .01,
        model: { booster: { trees: [{ score: 0, gain: .1 * day, sampleCount: 100, split: `Customer.Age < ${30 + day}`, left: { score: -.1, sampleCount: 40 }, right: { score: .2, sampleCount: 60 } }] } },
      })),
    })));
    await expect(evolution.getByRole('status')).toContainText('2 added');
    await inspect(page, testInfo, 'evolution');
    await expect(page.getByRole('region', { name: 'Model AI explanation', exact: true })).toHaveCount(1);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
