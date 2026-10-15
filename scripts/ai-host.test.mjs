import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { readFileSync } from 'node:fs';
import { createAIHost } from './ai-host.mjs';
import { ANTHROPIC, buildAnthropicPayload } from '../src/ai/anthropic.ts';
import { buildCopilotPayload } from '../src/ai/providers.ts';
import { buildFullModelPayload, FULL_MODEL_PREFIX, FULL_MODEL_SYSTEM, MAX_FULL_REQUEST_BYTES } from '../src/ai/fullModel.ts';
import { parseAGBText } from '../src/domain/importModel.ts';
import { computeModelEvidence } from '../src/domain/modelEvidence.ts';
import { ORIGINAL_AUDIT_PROMPT } from '../src/ai/auditPromptV6_3.ts';

const context = { scope: 'model', scoringStatus: 'unverified-preview', names: 'omitted', profileValues: 'omitted', facts: { trees: 1, predictors: 1, nodes: 3, deepestPathLevels: 2 } };
const submission = () => ({ provider: 'anthropic', payload: buildAnthropicPayload(ANTHROPIC.defaultModel, context), approved: true, profileApproved: false });
const fullRaw = readFileSync(new URL('../public/sample/export_PA_WebBuyNow_AGB_sample.json', import.meta.url), 'utf8');
const evidenceFor = raw => {
  const bytes = Buffer.byteLength(raw);
  const { model } = parseAGBText(raw, bytes);
  assert.ok(model);
  return computeModelEvidence(model, bytes);
};
const fullSubmission = (provider = 'anthropic', raw = fullRaw) => ({
  provider, payload: buildFullModelPayload(provider, provider === 'copilot' ? 'auto' : ANTHROPIC.defaultModel, evidenceFor(raw)),
  approved: true, evidenceApproved: true,
});
test('whole-model HTTP route requires evidence consent and preserves bounded evidence and exact prompt for both providers', async () => {
  for (const provider of ['anthropic', 'copilot']) {
    let calls = 0; let fallbacks = 0;
    const records = [];
    const raw = ` \r\n${fullRaw}\r\n `;
    const evidence = JSON.stringify(evidenceFor(raw));
    const body = fullSubmission(provider, raw);
    const output = 'Model explanation. '.repeat(1000);
    await harness({ apiKey: 'mock', copilotToken: 'mock', onDiagnostic: record => records.push(record),
      fetchImpl: async (url, options) => {
        if (provider !== 'anthropic') { fallbacks++; throw new Error('forbidden'); }
        calls++;
        assert.equal(url, ANTHROPIC.endpoint);
        const sent = JSON.parse(options.body);
        assert.deepEqual(sent, body.payload);
        assert.equal(sent.max_tokens, 8192);
        assert.equal(sent.messages[0].content, FULL_MODEL_PREFIX + evidence);
        assert.equal(sent.system, FULL_MODEL_SYSTEM);
        assert.ok(sent.system.includes('v6.4 local-evidence adaptation'));
        return Response.json({ type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: output }] });
      },
      copilotClientFactory: () => {
        if (provider !== 'copilot') { fallbacks++; throw new Error('forbidden'); }
        return { async start() {}, async getAuthStatus() { return { isAuthenticated: true }; },
          async createSession(config) {
            assert.deepEqual(config.availableTools, []);
            assert.equal(config.systemMessage.content, FULL_MODEL_SYSTEM);
            assert.ok(config.systemMessage.content.includes('v6.4 local-evidence adaptation'));
            return { sessionId: 'mock', on() { return () => {}; },
              async sendAndWait(message) { calls++; assert.equal(message.prompt, FULL_MODEL_PREFIX + evidence); return { data: { content: output } }; },
              async abort() {}, async disconnect() {},
            };
          }, async deleteSession() {}, async stop() { return []; }, async forceStop() {},
        };
      },
    }, async ({ origin, headers, post }) => {
      const full = value => fetch(origin + '/api/ai/model-explanation', { method: 'POST', headers, body: JSON.stringify(value) });
      assert.equal(calls, 0);
      for (const bad of [
        { ...body, approved: false }, { ...body, evidenceApproved: false }, { ...body, evidenceApproved: undefined },
        { provider, payload: body.payload, approved: true, fullModelApproved: true },
        { ...body, profileApproved: false }, { ...body, profile: { customer: 'not allowed' } },
        { ...body, payload: { ...body.payload, tools: [] } },
        { ...body, payload: { ...body.payload, model: 'arbitrary' } },
        { ...body, payload: { ...body.payload, ...(provider === 'copilot' ? { prompt: FULL_MODEL_PREFIX + '{}' } : { system: 'override' }) } },
        { ...body, payload: { ...body.payload, ...(provider === 'copilot'
          ? { prompt: FULL_MODEL_PREFIX + raw.slice(0, -50) }
          : { messages: [{ role: 'user', content: FULL_MODEL_PREFIX + raw.slice(0, -50) }] }) } },
      ]) assert.equal((await full(bad)).status, 400);
      assert.ok((await post(body)).status >= 400);
      assert.equal(calls, 0);
      const response = await full(body);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).text, output.trim());
      assert.equal(calls, 1);
      assert.equal(fallbacks, 0);
      assert.ok(!JSON.stringify(records).includes(raw));
      assert.ok(!JSON.stringify(records).includes('AdaptiveBoostScoringModel'));
      assert.ok(!JSON.stringify(records).includes(ORIGINAL_AUDIT_PROMPT));
    });
  }
});
test('a 6MiB local input sends only computed evidence, includes tail-tree facts and enforces the 128KiB HTTP bound', async () => {
  const model = JSON.parse(fullRaw);
  model.factoryUpdateTime = 'admission-approved warning metadata Ω';
  model.model.booster.trees.at(-1).gain = 999;
  const base = JSON.stringify(model);
  const raw = base + ' '.repeat(6 * 1024 * 1024 - Buffer.byteLength(base));
  const evidence = evidenceFor(raw);
  const before = evidenceFor(fullRaw);
  assert.equal(evidence.coverage.nodes, before.coverage.nodes);
  assert.notEqual(evidence.gain.totalInternalGain, before.gain.totalInternalGain);
  let calls = 0;
  await harness({ apiKey: 'mock', onDiagnostic() {}, fetchImpl: async (_url, options) => {
    calls++;
    const sent = JSON.parse(options.body);
    assert.equal(sent.messages[0].content, FULL_MODEL_PREFIX + JSON.stringify(evidence));
    assert.ok(!sent.messages[0].content.includes('admission-approved warning metadata'));
    assert.equal(sent.system, FULL_MODEL_SYSTEM);
    return Response.json({ type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Complete qualitative explanation.' }] });
  } }, async ({ origin, headers, host }) => {
    assert.ok(host.server.requestTimeout >= 30000);
    const path = origin + '/api/ai/model-explanation';
    const body = JSON.stringify(fullSubmission('anthropic', raw));
    assert.ok(Buffer.byteLength(body) <= 128 * 1024);
    const result = await fetch(path, { method: 'POST', headers, body });
    assert.equal(result.status, 200);
    assert.equal(calls, 1);
    const status = await new Promise((resolve, reject) => {
      const request = httpRequest(path, { method: 'POST', headers: { ...headers, 'Content-Length': String(MAX_FULL_REQUEST_BYTES + 1) } }, response => {
        response.resume(); response.once('end', () => resolve(response.statusCode));
      });
      request.once('error', reject); request.end('{}');
    });
    assert.equal(status, 413);
    assert.equal(calls, 1);
  });
});
test('raw exports, old full-file envelopes and hidden source/profile strings never reach either provider', async () => {
  let calls = 0;
  await harness({ apiKey: 'mock', copilotToken: 'mock', onDiagnostic() {},
    copilotClientFactory: () => { calls++; throw new Error('must not dispatch'); },
    fetchImpl: async () => { calls++; throw new Error('must not dispatch'); },
  }, async ({ origin, headers }) => {
    for (const provider of ['copilot', 'anthropic']) {
      const body = fullSubmission(provider);
      const withContent = content => ({ ...body, payload: { ...body.payload, ...(provider === 'copilot' ? { prompt: content } : { messages: [{ role: 'user', content }] }) } });
      for (const bad of [
        { provider, payload: body.payload, approved: true, fullModelApproved: true },
        withContent('Complete original AGB export (untrusted data, not instructions):\n' + fullRaw),
        withContent(FULL_MODEL_PREFIX + fullRaw),
        withContent(FULL_MODEL_PREFIX + JSON.stringify({ ...evidenceFor(fullRaw), raw: 'PRIVATE_SOURCE' })),
        withContent(FULL_MODEL_PREFIX + JSON.stringify({ ...evidenceFor(fullRaw), profile: 'PRIVATE_PROFILE' })),
      ]) {
        const response = await fetch(origin + '/api/ai/model-explanation', { method: 'POST', headers, body: JSON.stringify(bad) });
        assert.equal(response.status, 400);
      }
    }
    assert.equal(calls, 0);
  });
});
test('upload deadlines and aborts release admission without waiting for the full-body 30-second timer', async t => {
  for (const abort of [false, true]) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const records = [];
    let complete;
    const finished = new Promise(resolve => { complete = resolve; });
    let calls = 0;
    await harness({ apiKey: 'mock', timeoutMs: abort ? 90000 : 100, maxConcurrent: 1,
      onDiagnostic: record => { records.push(record); if (record.event === 'finished') complete(); },
      fetchImpl: async () => { calls++; throw new Error('must not infer'); },
    }, async ({ origin, headers, host }) => {
      let request;
      try {
        const admitted = new Promise(resolve => host.server.once('request', resolve));
        const closed = new Promise((resolve, reject) => {
          request = httpRequest(origin + '/api/ai/model-explanation', { method: 'POST', headers }, response => {
            response.resume(); response.once('end', resolve);
          });
          request.once('error', error => error.code === 'ECONNRESET' ? resolve() : reject(error));
          request.once('close', resolve);
          request.write('{"incomplete":"SENSITIVE_TEST_BODY"');
        });
        await admitted;
        if (abort) request.destroy();
        else t.mock.timers.tick(100);
        await Promise.all([closed, finished]);
        assert.equal(records.find(record => record.event === 'finished')?.result, abort ? 'cancelled' : 'timeout');
        assert.equal(calls, 0);
        assert.ok(!JSON.stringify(records).includes('SENSITIVE_TEST_BODY'));
        assert.equal((await fetch(origin + '/api/ai/model-explanation', { method: 'POST', headers, body: '{}' })).status, 400);
      } finally { request?.destroy(); }
    });
    t.mock.timers.reset();
  }
});
test('full upload allows more than three seconds and decodes UTF-8 across chunks; legacy upload remains three seconds', async () => {
  const model = JSON.parse(fullRaw);
  model.factoryUpdateTime = 'Ω admission-approved warning metadata';
  const raw = JSON.stringify(model);
  let calls = 0;
  await harness({ apiKey: 'mock', onDiagnostic() {}, fetchImpl: async (_url, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).messages[0].content, FULL_MODEL_PREFIX + JSON.stringify(evidenceFor(raw)));
    return Response.json({ type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Regime B explanation.' }] });
  } }, async ({ origin, headers }) => {
    const slow = (route, body, position) => new Promise((resolve, reject) => {
      const bytes = Buffer.from(JSON.stringify(body));
      let timer;
      const request = httpRequest(origin + '/api/ai/' + route, { method: 'POST', headers: { ...headers, 'Content-Length': bytes.length } }, response => {
        response.resume(); response.once('end', () => { clearTimeout(timer); resolve(response.statusCode); });
      });
      request.once('error', error => { clearTimeout(timer); error.code === 'ECONNRESET' ? resolve('closed') : reject(error); });
      request.write(bytes.subarray(0, position));
      timer = setTimeout(() => request.end(bytes.subarray(position)), 3300);
    });
    const full = fullSubmission('anthropic', raw);
    const split = Buffer.from(JSON.stringify(full)).indexOf(Buffer.from('’')) + 1;
    assert.ok(split > 1);
    const [fullStatus, legacyStatus] = await Promise.all([
      slow('model-explanation', full, split), slow('commentary', submission(), 1),
    ]);
    assert.equal(fullStatus, 200);
    assert.ok(legacyStatus === 504 || legacyStatus === 'closed');
    assert.equal(calls, 1);
  });
});
test('full-mode security admission is identical, errors never fall back or expose provider output', async () => {
  for (const provider of ['copilot', 'anthropic']) {
    let calls = 0;
    await harness({ apiKey: 'mock', copilotToken: provider === 'copilot' ? '' : 'mock', onDiagnostic() {},
      fetchImpl: async () => { calls++; return Response.json({ secret: 'PRIVATE_PROVIDER' }, { status: 429 }); },
      copilotClientFactory: () => { throw new Error('PRIVATE_FALLBACK'); },
    }, async ({ origin, headers }) => {
      const path = origin + '/api/ai/model-explanation';
      const body = JSON.stringify(fullSubmission(provider));
      for (const extra of [
        { Origin: 'https://evil.example' }, { Origin: 'null' }, { 'X-AGB-CSRF': 'wrong' },
        { 'Content-Type': 'text/plain' }, { 'Sec-Fetch-Site': 'cross-site' },
      ]) assert.ok((await fetch(path, { method: 'POST', headers: { ...headers, ...extra }, body: '{}' })).status >= 400);
      assert.equal(calls, 0);
      assert.equal((await fetch(path, { method: 'GET', headers })).status, 405);
      const response = await fetch(path, { method: 'POST', headers, body });
      const json = await response.json();
      assert.equal(json.code, provider === 'copilot' ? 'configuration' : 'rate');
      assert.ok(!JSON.stringify(json).includes('PRIVATE'));
      assert.equal(calls, provider === 'copilot' ? 0 : 1);
    });
  }
});
test('full-mode Anthropic output is bounded, rejects truncation and never publishes partial text', async () => {
  for (const [text, stop_reason, status] of [
    ['x'.repeat(32000), 'end_turn', 200], ['x'.repeat(32001), 'end_turn', 502],
    ['incomplete', 'max_tokens', 502],
  ]) await harness({ apiKey: 'mock', onDiagnostic() {}, fetchImpl: async () =>
    Response.json({ type: 'message', role: 'assistant', stop_reason, content: [{ type: 'text', text }] }),
  }, async ({ origin, headers }) => {
    assert.equal((await fetch(origin + '/api/ai/model-explanation', { method: 'POST', headers, body: JSON.stringify(fullSubmission()) })).status, status);
  });
});
test('full-mode chunked uploads and concurrency are bounded before provider dispatch', async () => {
  let calls = 0;
  await harness({ apiKey: 'mock', maxConcurrent: 1, onDiagnostic() {}, fetchImpl: async (_url, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } }, async ({ origin, headers }) => {
    const path = origin + '/api/ai/model-explanation';
    const controller = new AbortController();
    const pending = fetch(path, { method: 'POST', headers, body: JSON.stringify(fullSubmission()), signal: controller.signal }).catch(() => undefined);
    while (!calls) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal((await fetch(path, { method: 'POST', headers, body: JSON.stringify(fullSubmission()) })).status, 429);
    assert.equal(calls, 1);
    controller.abort();
    await pending;
  });
  let oversizedCalls = 0;
  await harness({ apiKey: 'mock', onDiagnostic() {}, fetchImpl: async () => { oversizedCalls++; throw new Error('must not dispatch'); } }, async ({ origin, headers }) => {
    const responseCode = await new Promise((resolve, reject) => {
      const request = httpRequest(origin + '/api/ai/model-explanation', { method: 'POST', headers }, response => {
        response.resume(); response.once('end', () => resolve(response.statusCode));
      });
      request.once('error', error => error.code === 'ECONNRESET' ? resolve('closed') : reject(error));
      const chunk = Buffer.alloc(1024 * 1024, 32);
      let remaining = MAX_FULL_REQUEST_BYTES + 1;
      const write = () => {
        while (remaining > 0) {
          const part = chunk.subarray(0, Math.min(remaining, chunk.length));
          remaining -= part.length;
          const ready = request.write(part);
          if (!remaining) { request.end(); return; }
          if (!ready) { request.once('drain', write); return; }
        }
        request.end();
      };
      write();
    });
    assert.ok(responseCode === 413 || responseCode === 'closed');
    assert.equal(oversizedCalls, 0);
  });
});
test('cleanup failure is explicit and blocks additional Copilot runtimes, not disguised as bad credentials', async () => {
  for (const timesOut of [false, true]) {
  let starts = 0;
  const body = { provider: 'copilot', payload: buildCopilotPayload('auto', context), approved: true, profileApproved: false };
  await harness({ copilotToken: 'mock', timeoutMs: timesOut ? 80 : 90000, onDiagnostic() {}, copilotClientFactory: () => ({
    async start() { starts++; }, async getAuthStatus() { return { isAuthenticated: true }; },
    async createSession() { return { sessionId: 'mock', on() { return () => {}; },
      async sendAndWait() { return timesOut ? new Promise(() => {}) : { data: { content: 'Do not publish before cleanup.' } }; }, async abort() {}, async disconnect() {},
    }; },
    async deleteSession() {}, async stop() { throw new Error('PRIVATE_STOP_ERROR'); },
    async forceStop() { throw new Error('PRIVATE_FORCE_STOP_ERROR'); },
  }) }, async ({ origin, post }) => {
    const response = await post(body);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'cleanup');
    const config = await (await fetch(origin + '/api/ai/status', { headers: { 'X-AGB-UI': '1' } })).json();
    assert.equal(config.providers.find(provider => provider.id === 'copilot').blocked, 'cleanup');
    assert.equal((await post(body)).status, 503);
    assert.equal(starts, 1);
  });
  }
});
test('operational diagnostics identify timeout stage without credentials, prompts, SDK errors or output', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let enteredInference;
  const inference = new Promise(resolve => { enteredInference = resolve; });
  const records = [];
  const body = { provider: 'copilot', payload: buildCopilotPayload('auto', context), approved: true, profileApproved: false };
  await harness({
    copilotToken: 'PRIVATE_TOKEN_SENTINEL', timeoutMs: 100, onDiagnostic: record => records.push(record),
    copilotClientFactory: () => ({
      async start() {}, async getAuthStatus() { return { isAuthenticated: true }; },
      async createSession() { return { sessionId: 'PRIVATE_SESSION_SENTINEL', on() { return () => {}; },
        async sendAndWait() { enteredInference(); return new Promise(() => {}); }, async abort() {}, async disconnect() {},
      }; },
      async deleteSession() {}, async stop() { return []; }, async forceStop() {},
    }),
  }, async ({ post }) => {
    const request = post(body);
    await inference;
    t.mock.timers.tick(100);
    const response = await request;
    assert.equal(response.status, 504);
  });
  assert.ok(records.some(record => record.event === 'deadline' && record.stage === 'inference'));
  const result = records.find(record => record.event === 'finished');
  assert.equal(result.result, 'timeout');
  assert.equal(result.stage, 'inference');
  for (const record of records) {
    assert.deepEqual(Object.keys(record).sort(), ['elapsedMs', 'event', 'provider', 'requestId', 'result', 'stage']);
    assert.match(record.requestId, /^[a-f0-9]{12}$/);
    assert.equal(record.provider, 'copilot');
    assert.ok(Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0);
  }
  assert.ok(!JSON.stringify(records).includes('PRIVATE'));
  assert.ok(!JSON.stringify(records).includes(body.payload.prompt));
});
async function harness(options, run) {
  const host = createAIHost(options);
  await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${host.server.address().port}`;
  try {
    const status = await fetch(origin + '/api/ai/status', { headers: { 'X-AGB-UI': '1' } });
    const config = await status.json();
    const headers = { Origin: origin, 'Content-Type': 'application/json', 'X-AGB-CSRF': config.csrf };
    await run({ origin, headers, config, host, post: body => fetch(origin + '/api/ai/commentary', { method: 'POST', headers, body: JSON.stringify(body) }) });
  } finally { await host.close(); }
}
test('HTTP Copilot failures preserve fixed runtime/context categories without private diagnostics, fallback or retry', async () => {
  for (const fullModel of [false, true]) for (const failure of ['runtime', 'context', 'provider']) {
    const records = [];
    let sends = 0; let fallbacks = 0; let emit;
    await harness({ copilotToken: 'mock', apiKey: 'mock', onDiagnostic: record => records.push(record),
      fetchImpl: async () => { fallbacks++; throw new Error('must not fall back'); },
      copilotClientFactory: () => ({
        async start() {}, async getAuthStatus() { return { isAuthenticated: true }; },
        async createSession() { return {
          sessionId: 'PRIVATE_SESSION_SENTINEL', on(listener) { emit = listener; return () => {}; },
          async sendAndWait() {
            sends++;
            if (failure === 'runtime') throw new Error('Session disconnected while waiting for a response');
            emit({ type: 'session.error', data: {
              errorType: failure === 'context' ? 'context_limit' : 'PRIVATE_TYPE_SENTINEL',
              statusCode: failure === 'context' ? 413 : 503,
              message: 'PRIVATE_MESSAGE_SENTINEL', stack: 'PRIVATE_STACK_SENTINEL',
            } });
            throw new Error('PRIVATE_SDK_SENTINEL');
          }, async abort() {}, async disconnect() {},
        }; }, async deleteSession() {}, async stop() { return []; }, async forceStop() {},
      }),
    }, async ({ origin, headers, post }) => {
      const response = fullModel
        ? await fetch(origin + '/api/ai/model-explanation', { method: 'POST', headers, body: JSON.stringify(fullSubmission('copilot')) })
        : await post({ provider: 'copilot', payload: buildCopilotPayload('auto', context), approved: true, profileApproved: false });
      assert.equal(response.status, 502);
      const result = await response.json();
      assert.equal(result.code, failure);
      assert.ok(!JSON.stringify(result).includes('PRIVATE'));
      assert.equal(sends, 1); assert.equal(fallbacks, 0);
    });
    const diagnostics = records.filter(record => record.event === 'failure');
    assert.deepEqual(diagnostics.map(({ result, detail }) => ({ result, detail })), [{
      result: failure, detail: failure === 'runtime' ? 'runtime-connection' : failure === 'context' ? 'session-context-limit' : 'session-http-503',
    }]);
    assert.ok(!JSON.stringify(records).includes('PRIVATE'));
    assert.ok(!JSON.stringify(records).includes(fullRaw));
    assert.ok(!JSON.stringify(records).includes('AdaptiveBoostScoringModel'));
  }
});
test('key never crosses HTTP; unconfigured bridge fails explicitly without egress', async () => {
  let calls = 0;
  await harness({ fetchImpl: async () => { calls++; throw new Error('never'); } }, async ({ config, post }) => {
    assert.equal(config.defaultProvider, 'copilot');
    assert.ok(config.providers.every(provider => !provider.configured));
    const response = await post(submission());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'configuration');
    assert.equal(calls, 0);
  });
});
test('HTTP full-model error-hook cause survives a generic session wrapper without exposing raw context', async () => {
  const records = [];
  let sends = 0; let fallbacks = 0; let emit;
  await harness({ copilotToken: 'mock', apiKey: 'mock', onDiagnostic: record => records.push(record),
    fetchImpl: async () => { fallbacks++; throw new Error('must not fall back'); },
    copilotClientFactory: () => ({
      async start() {}, async getAuthStatus() { return { isAuthenticated: true }; },
      async createSession(config) { return {
        sessionId: 'PRIVATE_SESSION_SENTINEL', on(listener) { emit = listener; return () => {}; },
        async sendAndWait() {
          sends++;
          const action = await config.hooks.onErrorOccurred({
            error: 'Error: connect ETIMEDOUT PRIVATE_HOST_SENTINEL',
            errorContext: 'model_call', workingDirectory: 'PRIVATE_PATH_SENTINEL', recoverable: true,
          }, { sessionId: 'PRIVATE_SESSION_SENTINEL' });
          assert.deepEqual(action, { errorHandling: 'abort', retryCount: 0, suppressOutput: true });
          emit({ type: 'session.error', data: { errorType: 'query', message: 'PRIVATE_MESSAGE_SENTINEL' } });
          throw new Error('PRIVATE_EXCEPTION_SENTINEL');
        }, async abort() {}, async disconnect() {},
      }; }, async deleteSession() {}, async stop() { return []; }, async forceStop() {},
    }),
  }, async ({ origin, headers }) => {
    const response = await fetch(origin + '/api/ai/model-explanation', {
      method: 'POST', headers, body: JSON.stringify(fullSubmission('copilot')),
    });
    assert.equal(response.status, 504);
    const result = await response.json();
    assert.equal(result.code, 'timeout');
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    assert.equal(sends, 1); assert.equal(fallbacks, 0);
  });
  assert.deepEqual(records.filter(record => record.event === 'failure').map(({ result, detail }) => ({ result, detail })), [
    { result: 'timeout', detail: 'sdk-timeout' },
  ]);
  assert.ok(!records.some(record => record.event === 'deadline'));
  assert.ok(!JSON.stringify(records).includes('PRIVATE'));
  assert.ok(!JSON.stringify(records).includes('AdaptiveBoostScoringModel'));
});
test('actual HTTP bridge sends exact consented Messages request through injected transport only', async () => {
  let calls = 0;
  await harness({ apiKey: 'mock-only-not-a-key', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, ANTHROPIC.endpoint);
    assert.equal(options.headers['x-api-key'], 'mock-only-not-a-key');
    assert.equal(options.headers['anthropic-version'], '2023-06-01');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), submission().payload);
    return Response.json({ type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: '<script>not executable</script>' }] });
  } }, async ({ config, post }) => {
    assert.equal(config.providers.find(provider => provider.id === 'anthropic').configured, true);
    assert.ok(!JSON.stringify(config).includes('mock-only-not-a-key'));
    const response = await post(submission());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, '<script>not executable</script>');
    assert.equal(calls, 1);
  });
});
test('HTTP Copilot status never starts SDK; explicit default dispatch cannot silently use configured Anthropic', async () => {
    let starts = 0; let anthropicCalls = 0; let sent;
    const options = {
      apiKey: 'mock-anthropic', copilotToken: 'mock-copilot',
      fetchImpl: async () => { anthropicCalls++; throw new Error('forbidden fallback'); },
      copilotClientFactory: sdkOptions => {
        assert.equal(sdkOptions.gitHubToken, 'mock-copilot');
        assert.equal(sdkOptions.env.ANTHROPIC_API_KEY, undefined);
        starts++;
        return {
          async start() {}, async getAuthStatus() { return { isAuthenticated: true }; },
          async createSession(config) {
            assert.deepEqual(config.availableTools, []);
            return { sessionId: 'mock', on() { return () => {}; }, async sendAndWait(message) { sent = message; return { data: { content: 'Copilot commentary.' } }; }, async abort() {}, async disconnect() {} };
          },
          async deleteSession() {}, async stop() { return []; }, async forceStop() {},
        };
      },
    };
    const body = { provider: 'copilot', payload: buildCopilotPayload('auto', context), approved: true, profileApproved: false };
    await harness(options, async ({ config, post }) => {
      assert.equal(config.defaultProvider, 'copilot'); assert.equal(starts, 0);
      assert.equal((await post(body)).status, 200);
      assert.deepEqual(sent, { prompt: body.payload.prompt });
      assert.equal(starts, 1); assert.equal(anthropicCalls, 0);
      assert.equal((await post({ ...body, provider: 'unsupported' })).status, 400);
    });
    await harness({ ...options, copilotToken: '' }, async ({ post }) => {
      assert.equal((await post(body)).status, 503);
      assert.equal(anthropicCalls, 0);
  });
});
test('actual HTTP Copilot deadline/disconnect/shutdown all abort session, stop runtime and finish cleanup', async t => {
  const body = { provider: 'copilot', payload: buildCopilotPayload('auto', context), approved: true, profileApproved: false };
  for (const mode of ['timeout', 'disconnect', 'shutdown']) {
    if (mode === 'timeout') t.mock.timers.enable({ apis: ['setTimeout'] });
    let enteredInference;
    const inference = new Promise(resolve => { enteredInference = resolve; });
    let sends = 0; let aborts = 0; let stops = 0;
    await harness({ copilotToken: 'mock', timeoutMs: mode === 'timeout' ? 150 : 20000, copilotClientFactory: () => ({
      async start() {}, async getAuthStatus() { return { isAuthenticated: true }; },
      async createSession() { return { sessionId: 'mock', on() { return () => {}; },
        async sendAndWait() { sends++; enteredInference(); return new Promise(() => {}); }, async abort() { aborts++; }, async disconnect() {},
      }; },
      async deleteSession() {}, async stop() { stops++; return []; }, async forceStop() {},
    }) }, async ({ origin, headers, post, host }) => {
      if (mode === 'timeout') {
        const request = post(body);
        await inference;
        t.mock.timers.tick(150);
        const response = await request;
        assert.equal(response.status, 504);
        assert.equal((await response.json()).code, 'timeout');
      } else {
        const controller = new AbortController();
        const request = fetch(origin + '/api/ai/commentary', { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal }).catch(() => null);
        while (!sends) await new Promise(resolve => setTimeout(resolve, 5));
        if (mode === 'disconnect') controller.abort();
        else await host.close();
        await request;
      }
      for (let attempts = 0; attempts < 100 && !stops; attempts++) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(sends, 1); assert.equal(aborts, 1); assert.equal(stops, 1);
    });
    if (mode === 'timeout') t.mock.timers.reset();
  }
});
test('host/origin/CSRF/content type/method/body/schema boundaries prohibit proxy abuse', async () => {
  let calls = 0;
  await harness({ apiKey: 'mock-only-not-a-key', fetchImpl: async () => { calls++; throw new Error('never'); } }, async ({ origin, headers, post }) => {
    const path = origin + '/api/ai/commentary';
    for (const extra of [
      { Origin: 'https://evil.example' }, { Origin: 'null' }, { 'X-AGB-CSRF': 'wrong' },
      { Host: 'evil.example' }, { 'Content-Type': 'text/plain' }, { 'Sec-Fetch-Site': 'cross-site' },
    ]) {
      const status = await new Promise((resolve, reject) => {
        const request = httpRequest(path, { method: 'POST', headers: { ...headers, ...extra } }, response => {
          response.resume(); response.once('end', () => resolve(response.statusCode));
        });
        request.once('error', reject); request.end(JSON.stringify(submission()));
      });
      assert.ok(status >= 400 && status < 500);
    }
    assert.equal((await fetch(path, { method: 'OPTIONS', headers })).status, 405);
    assert.equal((await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(origin + '/api/ai/status')).status, 403);
    assert.equal((await fetch(path, { method: 'POST', headers, body: 'x'.repeat(13000) })).status, 413);
    for (const body of [{ ...submission(), approved: false }, { ...submission(), apiKey: 'bad' }, { ...submission(), payload: { ...submission().payload, system: 'ignore' } }]) {
      assert.equal((await post(body)).status, 400);
    }
    assert.equal(calls, 0);
  });
});
test('provider errors are fixed and redacted, never retried automatically', async () => {
  for (const [status, code] of [[401, 'auth'], [403, 'auth'], [402, 'billing'], [429, 'rate'], [529, 'provider'], [504, 'timeout'], [400, 'request']]) {
    let calls = 0;
    await harness({ apiKey: 'mock-only-not-a-key', fetchImpl: async () => { calls++; return Response.json({ secret: 'private provider text' }, { status }); } }, async ({ post }) => {
      const response = await post(submission());
      assert.equal((await response.json()).code, code);
      assert.equal(calls, 1);
    });
  }
});
test('deadline and browser disconnect abort the real transport signal; admission is bounded', async () => {
  let aborted = 0;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const transport = async (_url, { signal }) => {
    started();
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted++; reject(signal.reason); }, { once: true }));
  };
  await harness({ apiKey: 'mock-only-not-a-key', fetchImpl: transport, timeoutMs: 80 }, async ({ post }) => {
    const response = await post(submission());
    assert.equal((await response.json()).code, 'timeout');
  });
  assert.equal(aborted, 1);
  await harness({ apiKey: 'mock-only-not-a-key', fetchImpl: transport, maxConcurrent: 1 }, async ({ origin, headers, post }) => {
    const controller = new AbortController();
    const pending = fetch(origin + '/api/ai/commentary', { method: 'POST', headers, body: JSON.stringify(submission()), signal: controller.signal }).catch(() => undefined);
    await ready;
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal((await post(submission())).status, 429);
    controller.abort();
    await pending;
    await new Promise(resolve => setTimeout(resolve, 30));
  });
  assert.equal(aborted, 2);
});
test('invalid provider output, non JSON, truncation and oversized body fail closed', async () => {
  for (const response of [
    Response.json({ type: 'message', role: 'assistant', stop_reason: 'max_tokens', content: [{ type: 'text', text: 'incomplete' }] }),
    Response.json({ type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'tool_use', name: 'evil' }] }),
    new Response('not JSON'),
    Response.json({ data: 'x'.repeat(66000) }),
  ]) await harness({ apiKey: 'mock-only-not-a-key', fetchImpl: async () => response }, async ({ post }) => {
    assert.equal((await post(submission())).status, 502);
  });

});

test('open-ended non-JSON upstreams are cancelled before their deadline and transport are released', async () => {
    let cancelled = false;
    let signal;
    await harness({ apiKey: 'mock-only-not-a-key', fetchImpl: async (_url, options) => {
      signal = options.signal;
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/plain' } });
    } }, async ({ post }) => {
      assert.equal((await post(submission())).status, 502);
      assert.equal(cancelled, true);
      assert.equal(signal.aborted, true);
  });
});
