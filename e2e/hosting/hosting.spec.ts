import { expect, test } from '@playwright/test';

test('hardened reference subpath serves sample, worker and home without CSP violations', async ({ page, request }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { agbCspViolations: violations });
    document.addEventListener('securitypolicyviolation', event => violations.push(event.violatedDirective));
  });
  const response = await page.goto('./');
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter diagram fullscreen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Tree 1 diagram fullscreen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit diagram fullscreen', exact: true }).click();
  await page.getByRole('button', { name: 'Model insights', exact: true }).click();
  const audit = page.getByRole('region', { name: 'Local model insights', exact: true });
  await expect(audit.getByRole('heading', { name: 'Understand this model' })).toBeVisible();
  await audit.getByRole('button', { name: 'Predictors', exact: true }).click();
  await expect(audit.getByRole('table', { name: /Exact predictor evidence across/ })).toBeVisible();
  await audit.getByRole('checkbox', { name: 'I approve preparing a sensitive local audit download.' }).check();
  await audit.getByRole('button', { name: 'Prepare audit HTML', exact: true }).click();
  await expect(audit.getByRole('link', { name: 'Save prepared audit HTML', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Model evolution', exact: true }).click();
  await page.getByRole('checkbox', { name: /I confirm these snapshots/ }).check();
  await page.getByLabel('Snapshot export files', { exact: true }).setInputFiles([1, 2].map(day => ({
    name: `synthetic-day-${day}.json`, mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST',
      factoryUpdateTime: `2024-01-0${day}T00:00:00.000Z`,
      model: { booster: { trees: [{ score: .1, sampleCount: 1 }] } },
    })),
  })));
  await expect(page.locator('.model-evolution').getByRole('status')).toContainText('2 added');
  await expect(page.getByRole('region', { name: 'Evolution insights', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Trace a profile' }).click();
  await expect(page.getByText('Unverified propensity preview', { exact: true })).toBeVisible();
  await expect(page.locator('.contextual-ai')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Contextual AI commentary' })).toHaveCount(0);
  const full = page.getByRole('region', { name: 'Model AI explanation', exact: true });
  await full.getByRole('checkbox', { name: /Enable optional whole-model/ }).check();
  await expect(full.getByRole('link', { name: /exact full provider payload/ })).toBeVisible();
  await expect(full.getByText(/Set COPILOT_GITHUB_TOKEN/)).toBeVisible();
  await expect(full.getByRole('button', { name: /Generate approved/ })).toBeDisabled();
  expect(await page.evaluate(() => Reflect.get(window, 'agbCspViolations'))).toEqual([]);
  await page.getByRole('link', { name: 'Experience AGB home' }).click();
  await expect(page.getByRole('button', { name: /Try the bundled sample/ })).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:5182/ExperienceAGB/');
  expect((await request.get('/sample/export_PA_WebBuyNow_AGB_sample.json')).status()).toBe(404);
  expect((await request.post('./', { data: 'never a model upload' })).status()).toBe(405);
});
