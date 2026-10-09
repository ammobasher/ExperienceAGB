import { expect, test } from '@playwright/test';

test('actual Tab navigation opens sample and preserves focus through workspace close', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Experience AGB home' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Browse files/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Try the bundled sample/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pega AGB sample' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Open another' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Browse files/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Browse files/ })).toBeFocused();
});

test('emulated half-width high-DPI reflow and reduced motion retain core workflow', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Viewport and pixel-density emulation requires Chromium CDP; this is not browser zoom.');
  await page.setViewportSize({ width: 1280, height: 900 });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 640, height: 450, deviceScaleFactor: 2, mobile: false,
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.getByRole('region', { name: 'Model workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Trace a profile' }).click();
  await page.getByText(/Edit illustrative profile/).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByRole('button', { name: 'Open another' }).evaluate(element => {
    const style = getComputedStyle(element);
    return style.transitionDuration.split(',').every(duration => parseFloat(duration) <= 0.01);
  })).toBe(true);
  await session.detach();
});
