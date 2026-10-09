import { expect, test } from '@playwright/test';

test('AI-disabled exploration stays same-origin and creates no persistent browser data', async ({ page }) => {
  const requests: Array<{ origin: string; method: string }> = [];
  page.on('request', request => requests.push({
    origin: new URL(request.url()).origin,
    method: request.method(),
  }));
  await page.goto('/');
  const origin = new URL(page.url()).origin;
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Trace a profile' }).click();
  await page.getByText(/Edit illustrative profile/).click();
  await page.getByRole('button', { name: 'New illustration' }).click();
  await page.getByRole('button', { name: /Open another/ }).click();
  await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
  await page.reload();
  expect(requests.every(request => request.origin === origin && request.method === 'GET')).toBe(true);
  const persistence = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: await indexedDB.databases(),
    caches: await caches.keys(),
    registrations: (await navigator.serviceWorker.getRegistrations()).length,
    cookie: document.cookie,
  }));
  expect(persistence).toEqual({ local: [], session: [], databases: [], caches: [], registrations: 0, cookie: '' });
});
