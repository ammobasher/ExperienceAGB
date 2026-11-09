import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDesktopCredentials, readDesktopCredentials, MAX_CREDENTIAL_BYTES } from './credentials.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('only explicitly supplied session credentials are accepted, with no ambient fallback', () => {
  assert.deepEqual(parseDesktopCredentials('{"copilotToken":"mock"}'), { copilotToken: 'mock', apiKey: '' });
  assert.deepEqual(parseDesktopCredentials('{"anthropicApiKey":"mock"}'), { copilotToken: '', apiKey: 'mock' });
  assert.deepEqual(parseDesktopCredentials('{"copilotToken":"one","anthropicApiKey":"two"}'), { copilotToken: 'one', apiKey: 'two' });
});
test('malformed, duplicated, oversized and unsupported credential input fails without echoing secrets', () => {
  for (const input of ['{}', 'null', '[]', '{', '{"token":"SENSITIVE_TEST"}',
    '{"copilotToken":"SENSITIVE_TEST","copilotToken":"second"}',
    '{"copilotToken":"SENSITIVE_TEST","copilot\\u0054oken":"second"}',
    '{"copilotToken":42}', '{"copilotToken":""}', '{"copilotToken":" leading"}',
    '{"copilotToken":"trailing "}', '{"copilotToken":"line\\nbreak"}',
    '{"copilotToken":"' + 'a'.repeat(513) + '"}', ' '.repeat(MAX_CREDENTIAL_BYTES + 1),
  ]) assert.throws(() => parseDesktopCredentials(input), error => !error.message.includes('SENSITIVE_TEST'));
});
test('credential file reads are bounded and require valid UTF-8, even before JSON parsing', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'experience-agb-credential-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'synthetic.json');
  await writeFile(path, '{"copilotToken":"mock"}');
  assert.equal((await readDesktopCredentials(path)).copilotToken, 'mock');
  await writeFile(path, Buffer.alloc(MAX_CREDENTIAL_BYTES + 1, 32));
  await assert.rejects(readDesktopCredentials(path), /exceeds 4 KiB/);
  await writeFile(path, Buffer.from([0xff]));
  await assert.rejects(readDesktopCredentials(path), /valid JSON/);
});
