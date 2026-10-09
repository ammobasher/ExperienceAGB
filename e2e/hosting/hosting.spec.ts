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
  await page.getByRole('button', { name: 'Trace a profile' }).click();
  await expect(page.getByText('Unverified propensity preview', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, 'agbCspViolations'))).toEqual([]);
  await page.getByRole('link', { name: 'Experience AGB home' }).click();
  await expect(page.getByRole('button', { name: /Try the bundled sample/ })).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:5182/ExperienceAGB/');
  expect((await request.get('/sample/export_PA_WebBuyNow_AGB_sample.json')).status()).toBe(404);
  expect((await request.post('./', { data: 'never a model upload' })).status()).toBe(405);
});
