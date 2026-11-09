import { _electron as electron } from '@playwright/test';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { desktopRuntimePath } from './policy.cjs';

const resources = process.platform === 'win32' ? join('release', 'win-unpacked', 'resources') : join('release', `mac${process.arch === 'arm64' ? '-arm64' : ''}`, 'ExperienceAGB.app', 'Contents', 'Resources');
const path = desktopRuntimePath(resolve(resources), process.platform, process.arch);
await access(path);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'COPILOT_GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN'].includes(key)));
const profile = await mkdtemp(join(tmpdir(), 'experience-agb-electron-runtime-probe-'));
env.DESKTOP_RUNTIME_TEST_PROFILE = profile;
let app;
try {
  app = await electron.launch({ args: ['.desktop-build/runtime-check.mjs'], env, timeout: 90_000 });
  const virtual = path.replace('app.asar.unpacked', 'app.asar');
  const failure = await app.evaluate((_electron, value) => globalThis.probeVirtualRuntime(value), virtual);
  assert.ok(['ENOENT', 'ENOTDIR'].includes(failure), 'spawn cannot execute an ASAR virtual path');
  const result = await app.evaluate((_electron, value) => globalThis.verifyBundledRuntime(value), path);
  assert.deepEqual(result, { authenticated: false, stopped: true });
} finally {
  try { await app?.close(); }
  finally { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}
console.log('Actual Electron ASAR-path failure reproduced; physically unpacked bundled runtime starts/checks auth/stops without credentials, sessions or inference.');
