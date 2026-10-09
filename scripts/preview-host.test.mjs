import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewHost, securityHeaders } from './preview-host.mjs';

test('reference host enforces headers, subpath, methods and asset isolation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agb-host-'));
  await writeFile(join(root, 'index.html'), '<h1>Preview</h1>');
  await writeFile(join(root, 'worker.js'), 'self.onmessage=()=>{};');
  const server = createPreviewHost({ root, base: '/ExperienceAGB/' });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${origin}/ExperienceAGB/`);
    assert.equal(response.status, 200);
    for (const [name, value] of Object.entries(securityHeaders)) assert.equal(response.headers.get(name), value);
    assert.match(await response.text(), /Preview/);
    const worker = await fetch(`${origin}/ExperienceAGB/worker.js`);
    assert.match(worker.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(`${origin}/ExperienceAGB/`, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(`${origin}/ExperienceAGB/`, { method: 'POST', body: 'private' })).status, 405);
    for (const path of ['/', '/ExperienceAGB/missing.js', '/ExperienceAGB/%2e%2e%2fpackage.json', '/ExperienceAGB/%5csecret', '/ExperienceAGB/%00']) {
      assert.equal((await fetch(origin + path)).status, 404, path);
    }
    assert.equal((await fetch(`${origin}/ExperienceAGB/%ZZ`)).status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('host rejects ambiguous base paths', () => {
  assert.throws(() => createPreviewHost({ base: '/bad//path/' }));
  assert.throws(() => createPreviewHost({ base: 'relative/' }));
});
