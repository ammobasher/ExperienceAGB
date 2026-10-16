import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const model = {
  type: 'AdaptiveBoostScoringModel', algorithm: 'GRADIENT_BOOST', modelVersion: '2',
  factoryUpdateTime: '2024-01-01T00:00:00.000Z',
  model: { booster: { trees: [{ score: 0, gain: .1, sampleCount: 100, split: 'Customer.Age < 30', left: { score: -.2, sampleCount: 40 }, right: { score: .4, sampleCount: 60 } }] } },
};
const modelText = JSON.stringify(model);
const companion = () => ({
  schema: 'experience-agb-propensity-mapping-v1',
  sourceSha256: createHash('sha256').update(modelText).digest('hex'),
  exportTag: '2', exportUpdateTime: model.factoryUpdateTime, inputDomain: 'raw-score', method: 'exported-values',
  context: { modelId: 'synthetic-model', action: 'Synthetic action', channel: 'Web', direction: 'Inbound' },
  provenance: { reference: 'Synthetic mapping, not Pega-verified', platformVersion: 'test', capturedAt: '2024-01-01T00:00:00.000Z' },
  bins: [{ lower: -1, upper: 0, propensity: .1, positives: 10, negatives: 90 }, { lower: 0, upper: 1, propensity: .2, positives: 20, negatives: 80 }],
});
const file = (name: string, text: string) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });

for (const mobile of [false, true]) {
  test(`optional companion mapping stays model-bound, explainable and local (${mobile ? 'mobile' : 'desktop'})`, async ({ page }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const writes: string[] = [], errors: string[] = [];
    page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles(file('synthetic-mapping-model.json', modelText));
    await page.getByRole('button', { name: 'Trace a profile', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Optional Pega score-to-propensity mapping', exact: true });
    await expect(panel).toContainText('Classifier mapping required');
    await expect(page.locator('.ensemble-score')).toContainText('59.87%');
    await panel.getByText('Import or prepare a companion mapping', { exact: true }).click();
    await panel.getByText('Model fingerprint and empty template', { exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Prepare empty companion template', exact: true })).toBeDisabled();
    await panel.getByRole('checkbox', { name: /I approve preparing a local template/ }).check();
    await panel.getByRole('button', { name: 'Prepare empty companion template', exact: true }).click();
    const download = page.waitForEvent('download');
    await panel.getByRole('link', { name: 'Save empty companion template', exact: true }).click();
    const path = testInfo.outputPath('empty-companion-template.json');
    await (await download).saveAs(path);
    const template = JSON.parse(await readFile(path, 'utf8'));
    expect(template).toMatchObject({ sourceSha256: companion().sourceSha256, exportTag: '2', inputDomain: '', method: '', bins: [] });
    await panel.getByLabel('Companion mapping JSON', { exact: true }).setInputFiles(file('synthetic-companion.json', JSON.stringify(companion())));
    await expect(panel).toContainText('Companion loaded locally');
    await expect(panel.locator('.mapping-result')).toHaveCount(0);
    const confirmation = panel.getByRole('checkbox', { name: /I confirm this mapping/ });
    await confirmation.focus(); await page.keyboard.press('Space');
    await expect(panel.locator('.mapping-probability')).toHaveText('20%');
    await expect(panel.locator('.mapping-result')).toContainText('20 positive / 80 negative');
    await expect(panel.getByRole('row', { name: /2 — matched/ })).toContainText('[0, 1]');
    const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations;
    await writeFile(testInfo.outputPath('axe-mapping.json'), JSON.stringify(violations, null, 2));
    expect(violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.screenshot({ path: testInfo.outputPath('confirmed-mapping.png') });
    await page.getByText('Edit illustrative profile', { exact: false }).click();
    await page.getByRole('textbox', { name: 'Illustrative Customer.Age', exact: true }).fill('20');
    await expect(panel.locator('.mapping-probability')).toHaveText('10%');
    await expect(page.locator('.ensemble-score')).toContainText('45.02%');
    await page.getByRole('button', { name: 'Explore trees', exact: true }).click();
    await page.getByRole('button', { name: 'Model insights', exact: true }).click();
    await page.getByRole('button', { name: 'Trace a profile', exact: true }).click();
    await expect(panel.locator('.mapping-probability')).toHaveText('10%');
    await page.getByRole('textbox', { name: 'Illustrative Customer.Age', exact: true }).fill('not-a-number');
    await expect(panel).toContainText('complete, finite ensemble route');
    await expect(panel.locator('.mapping-result')).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Illustrative Customer.Age', exact: true }).fill('30');
    const narrow = { ...companion(), bins: [{ lower: -.1, upper: .1, propensity: .9, positives: 9, negatives: 1 }] };
    await panel.getByLabel('Companion mapping JSON', { exact: true }).setInputFiles(file('narrow.json', JSON.stringify(narrow)));
    await expect(confirmation).not.toBeChecked();
    await confirmation.check();
    await expect(panel).toContainText('outside the supplied intervals');
    await expect(panel.locator('.mapping-result')).toHaveCount(0);
    await panel.getByLabel('Companion mapping JSON', { exact: true }).setInputFiles(file('wrong-model.json', JSON.stringify({ ...companion(), sourceSha256: 'b'.repeat(64) })));
    await expect(panel.getByRole('alert')).toContainText('does not match');
    await expect(confirmation).not.toBeChecked();
    await panel.getByRole('button', { name: 'Clear mapping', exact: true }).click();
    await expect(panel.getByRole('table')).toHaveCount(0);
    await panel.getByLabel('Companion mapping JSON', { exact: true }).setInputFiles(file('sigmoid.json', JSON.stringify({ ...companion(), inputDomain: 'sigmoid-preview', bins: [{ lower: 0, upper: .5, propensity: .15, positives: 15, negatives: 85 }, { lower: .5, upper: 1, propensity: .35, positives: 35, negatives: 65 }] })));
    await expect(panel).toContainText('Companion loaded locally');
    await confirmation.check();
    await expect(panel.locator('.mapping-probability')).toHaveText('35%');
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []]);
    await page.reload();
    await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
    await page.locator('input[type=file]').setInputFiles(file('synthetic-mapping-model.json', modelText));
    await page.getByRole('button', { name: 'Trace a profile', exact: true }).click();
    await expect(panel).toContainText('Classifier mapping required');
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
