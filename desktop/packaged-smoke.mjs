import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { getCurrentFuseWire, FuseV1Options, FuseState } from '@electron/fuses';

const output = resolve(process.env.DESKTOP_TEST_OUTPUT ?? 'desktop-results');
await mkdir(output, { recursive: true });
const defaultExecutable = process.platform === 'win32' ? join('release', 'win-unpacked', 'ExperienceAGB.exe') : join('release', `mac${process.arch === 'arm64' ? '-arm64' : ''}`, 'ExperienceAGB.app', 'Contents', 'MacOS', 'ExperienceAGB');
const executable = resolve(process.env.DESKTOP_EXECUTABLE ?? defaultExecutable);
const launcher = resolve(process.env.DESKTOP_LAUNCHER ?? executable);
const wire = await getCurrentFuseWire(process.platform === 'darwin' ? resolve(executable, '..', '..', '..') : executable);
for (const fuse of [FuseV1Options.RunAsNode, FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseV1Options.EnableNodeCliInspectArguments, FuseV1Options.GrantFileProtocolExtraPrivileges]) expect(wire[fuse]).toBe(FuseState.DISABLE);
expect(wire[FuseV1Options.OnlyLoadAppFromAsar]).toBe(FuseState.ENABLE);
expect(wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]).toBe(FuseState.ENABLE);
const reservation = createServer();
await new Promise(done => reservation.listen(0, '127.0.0.1', done));
const port = reservation.address().port;
await new Promise(done => reservation.close(done));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'COPILOT_GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN'].includes(key)));
const started = performance.now();
const child = spawn(launcher, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'], { cwd: output, env, stdio: ['ignore', 'ignore', 'pipe'] });
child.stderr.resume();
let spawnError;
child.once('error', error => { spawnError = error; });
const exited = new Promise(done => child.once('exit', code => done(code)));
let browser, origin;
try {
  await expect.poll(async () => {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Packaged app exited before startup (${child.exitCode}).`);
    try { return (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
  }, { timeout: launcher === executable ? 60_000 : 180_000 }).toBe(true);
  const startupMs = Math.round(performance.now() - started);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = browser.contexts()[0].pages()[0];
  await expect(page.getByRole('button', { name: /Try the bundled sample/ })).toBeVisible();
  origin = new URL(page.url()).origin;
  expect(await page.evaluate(() => [typeof require, typeof process])).toEqual(['undefined', 'undefined']);
  await page.getByRole('button', { name: /Try the bundled sample/ }).click();
  await expect(page.locator('.diagram-workspace')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Model insights', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Understand this model', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Enable optional whole-model explanation', exact: true }).check();
  await expect(page.getByRole('region', { name: 'Model AI explanation', exact: true })).toContainText('Desktop: use File > Load AI credentials');
  await page.screenshot({ path: join(output, 'packaged-app.png') });
  const closing = performance.now();
  if (process.platform === 'win32') await page.evaluate(() => { setTimeout(() => window.close(), 100); });
  else child.kill('SIGTERM');
  await expect.poll(async () => { try { await fetch(origin, { signal: AbortSignal.timeout(1000) }); return true; } catch { return false; } }).toBe(false);
  const backendShutdownMs = Math.round(performance.now() - closing);
  let timer;
  const code = await Promise.race([exited, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Packaged app did not quit.')), launcher === executable ? 20_000 : 180_000); })]).finally(() => clearTimeout(timer));
  expect(code).toBe(0);
  await writeFile(join(output, 'packaged-acceptance.json'), JSON.stringify({ platform: process.platform, architecture: process.arch, executable, launcher, origin, startupMs, backendShutdownMs, launcherCleanupMs: Math.round(performance.now() - closing), fused: true, sampleWorker: true, localInsights: true, defaultAIUnconfigured: true, nodeIntegration: false, shutdownVerified: true }, null, 2));
} finally {
  await browser?.close();
  if (child.exitCode === null) child.kill();
}
console.log('Packaged executable passed; hardened fuses and owned backend shutdown verified.');
