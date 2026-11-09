import { _electron as electron, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

const output = resolve(process.env.DESKTOP_TEST_OUTPUT ?? 'desktop-results');
await mkdir(output, { recursive: true });
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'COPILOT_GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN'].includes(key)));
env.COPILOT_GITHUB_TOKEN = 'ambient-test-must-not-be-used';
env.ANTHROPIC_API_KEY = 'ambient-test-must-not-be-used';
const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env, timeout: 90_000 });
let origin, acceptance;
try {
  const page = await app.firstWindow();
  const writes = [];
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await expect(page.getByRole('button', { name: /Try the bundled sample/ })).toBeVisible();
  origin = new URL(page.url()).origin;
  const preferences = await app.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    const values = contents.getLastWebPreferences();
    return { node: values.nodeIntegration, isolation: values.contextIsolation, sandbox: values.sandbox, partition: contents.session.getStoragePath() };
  });
  expect(preferences).toMatchObject({ node: false, isolation: true, sandbox: true, partition: null });
  expect(await page.evaluate(() => [typeof require, typeof process, Object.keys(window.experienceAGBDesktop)])).toEqual(['undefined', 'undefined', ['onAIConfigurationChanged']]);
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.locator('.diagram-workspace')).toHaveAttribute('aria-busy', 'false');
  await app.evaluate(({ BrowserWindow }) => {
    globalThis.desktopNativeFullscreen = { entered: false, left: false };
    const window = BrowserWindow.getAllWindows()[0];
    window.once('enter-full-screen', () => { globalThis.desktopNativeFullscreen.entered = true; });
    window.once('leave-full-screen', () => { globalThis.desktopNativeFullscreen.left = true; });
  });
  await page.getByRole('button', { name: 'Enter diagram fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  // Cocoa completes its native transition after the DOM fullscreen event.
  await expect.poll(() => app.evaluate(() => globalThis.desktopNativeFullscreen.entered)).toBe(true);
  await page.getByRole('button', { name: 'Exit diagram fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await expect.poll(() => app.evaluate(() => globalThis.desktopNativeFullscreen.left)).toBe(true);
  await page.getByRole('button', { name: 'Model insights', exact: true }).click();
  const audit = page.getByRole('region', { name: 'Local model insights', exact: true });
  const saved = join(output, 'native-audit.json');
  await app.evaluate(({ BrowserWindow }, path) => {
    BrowserWindow.getAllWindows()[0].webContents.session.on('will-download', (_event, item) => item.setSavePath(path));
  }, saved);
  await audit.getByRole('checkbox', { name: 'I approve preparing a sensitive local audit download.' }).check();
  await audit.getByRole('button', { name: 'Prepare evidence bundle JSON', exact: true }).click();
  await audit.getByRole('link', { name: 'Save prepared audit JSON', exact: true }).click();
  await expect.poll(async () => { try { return JSON.parse(await readFile(saved, 'utf8')).manifest.source.digest; } catch { return ''; } }).toMatch(/^[a-f0-9]{64}$/);
  const ai = page.getByRole('region', { name: 'Model AI explanation', exact: true });
  await ai.getByRole('checkbox', { name: 'Enable optional whole-model explanation', exact: true }).check();
  await expect(ai).toContainText('Desktop: use File > Load AI credentials');
  const credentials = join(output, 'synthetic-desktop-credentials.json');
  await writeFile(credentials, '{"copilotToken":"synthetic-test-not-a-real-token"}');
  await app.evaluate(({ dialog, Menu }, path) => {
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    const item = Menu.getApplicationMenu().items.find(entry => entry.label === 'File').submenu.items.find(entry => entry.label === 'Load AI credentials...');
    item.click();
  }, credentials);
  await expect(ai).toContainText('Server credential configured');
  await ai.getByRole('checkbox', { name: /I am responsible/ }).check();
  await ai.getByRole('checkbox', { name: /I approve sending computed/ }).check();
  await ai.getByRole('checkbox', { name: /I reviewed and approve/ }).check();
  await expect(ai.getByRole('button', { name: 'Generate approved model explanation', exact: true })).toBeEnabled();
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(entry => entry.label === 'File').submenu.items.find(entry => entry.label === 'Clear AI credentials').click());
  await expect(ai).toContainText('Desktop: use File > Load AI credentials');
  await expect(ai.getByRole('checkbox', { name: /I reviewed and approve/ })).not.toBeChecked();
  await expect(ai.getByRole('button', { name: 'Generate approved model explanation', exact: true })).toBeDisabled();
  await expect(audit.getByRole('heading', { name: 'Understand this model', exact: true })).toBeVisible();

  await page.reload();
  const model = { type: 'AdaptiveBoostScoringModel', algorithm: 'GRADIENT_BOOST', modelVersion: '2', model: { booster: { trees: [{ score: 0, gain: .1, sampleCount: 100, split: 'Customer.Age < 30', left: { score: -.2, sampleCount: 40 }, right: { score: .4, sampleCount: 60 } }] } } };
  const text = JSON.stringify(model);
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-desktop-model.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: 'Trace a profile', exact: true }).click();
  await expect(page.locator('.ensemble-score')).toContainText('59.87%');
  await page.getByText('Edit illustrative profile', { exact: false }).click();
  await page.getByRole('textbox', { name: 'Illustrative Customer.Age', exact: true }).fill('20');
  await expect(page.locator('.ensemble-score')).toContainText('45.02%');
  const mapping = page.getByRole('region', { name: 'Optional Pega score-to-propensity mapping', exact: true });
  await mapping.getByText('Import or prepare a companion mapping', { exact: true }).click();
  await mapping.getByLabel('Companion mapping JSON', { exact: true }).setInputFiles({ name: 'synthetic-companion.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    schema: 'experience-agb-propensity-mapping-v1', sourceSha256: createHash('sha256').update(text).digest('hex'), exportTag: '2', exportUpdateTime: null, inputDomain: 'raw-score', method: 'exported-values',
    context: { modelId: 'synthetic', action: 'test', channel: 'Web', direction: 'Inbound' }, provenance: { reference: 'synthetic', platformVersion: 'test', capturedAt: '2024-01-01T00:00:00.000Z' }, bins: [{ lower: null, upper: null, propensity: .2 }],
  })) });
  await mapping.getByRole('checkbox', { name: /I confirm this mapping/ }).check();
  await expect(mapping.locator('.mapping-probability')).toHaveText('20%');
  await page.screenshot({ path: join(output, 'desktop-trace.png'), fullPage: true });
  const accessibility = await new AxeBuilder({ page }).setLegacyMode(true).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(390, 844));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(output, 'desktop-narrow.png') });
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []]);
  expect(writes).toEqual([]);
  acceptance = { platform: process.platform, architecture: process.arch, preferences, journeys: ['bundled model worker', 'native fullscreen', 'native audit save', 'session credential load/clear without inference', 'profile edits', 'companion import', 'axe A/AA', 'narrow reflow', 'no browser storage', 'graceful shutdown'], axeViolations: accessibility.violations.length };
} finally { await app.close(); }
await expect.poll(async () => { try { await fetch(origin, { signal: AbortSignal.timeout(1000) }); return true; } catch { return false; } }).toBe(false);
await writeFile(join(output, 'desktop-acceptance.json'), JSON.stringify({ ...acceptance, shutdownVerified: true }, null, 2));
console.log('Desktop native journeys passed; owned backend stopped.');
