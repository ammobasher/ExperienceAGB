import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localURL, allowedPermission, downloadName, desktopRuntimePath } from './policy.cjs';
import { join } from 'node:path';

const origin = 'http://127.0.0.1:54321';
test('desktop loads only its owned loopback origin and scoped blob downloads', () => {
  for (const url of [origin + '/', origin + '/assets/app.js', origin + '/api/ai/status']) assert.equal(localURL(url, origin), true);
  for (const url of ['file:///private.json', 'https://example.com/', 'http://localhost:54321/', 'http://127.0.0.1:54322/', origin + '@example.com/', 'http://token@127.0.0.1:54321/', 'javascript:alert(1)', 'data:text/html,hello', 'not a URL']) assert.equal(localURL(url, origin, true), false);
  assert.equal(localURL('blob:' + origin + '/id', origin), false);
  assert.equal(localURL('blob:' + origin + '/id', origin, true), true);
  assert.equal(localURL('blob:https://example.com/id', origin, true), false);
});
test('only owned fullscreen is permitted; privileged devices and filesystem access are denied', () => {
  assert.equal(allowedPermission('fullscreen', origin + '/', origin), true);
  for (const permission of ['media', 'geolocation', 'notifications', 'clipboard-read', 'fileSystem', 'midi', 'unknown']) assert.equal(allowedPermission(permission, origin, origin), false);
  assert.equal(allowedPermission('fullscreen', 'https://example.com', origin), false);
});
test('download defaults cannot supply path traversal or invalid native separators', () => {
  assert.equal(downloadName('..\\..\\private.json'), 'private.json');
  assert.equal(downloadName('../../audit.json'), 'audit.json');
  assert.equal(downloadName(''), 'ExperienceAGB-download');
  assert.equal(downloadName('..'), 'ExperienceAGB-download');
  assert.equal(downloadName('audit:*.json'), 'audit__.json');
  assert.equal(downloadName('a'.repeat(200)).length, 180);
});
test('the owned SDK executable path is physically unpacked, not an ASAR virtual path', () => {
  assert.equal(desktopRuntimePath('resources', 'win32', 'x64'), join('resources', 'app.asar.unpacked', 'node_modules', '@github', 'copilot-sdk-win32-x64', 'prebuilds', 'win32-x64', 'copilot-runtime.exe'));
  assert.ok(desktopRuntimePath('resources', 'darwin', 'arm64').endsWith(join('darwin-arm64', 'copilot-runtime')));
  assert.throws(() => desktopRuntimePath('resources', 'unknown', 'x64'));
});
