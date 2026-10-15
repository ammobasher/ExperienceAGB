import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runCopilot, childEnvironment } from './copilot.ts';
import { buildProviderPayload } from '../src/ai/providers.ts';
import { REQUEST_TIMEOUT_MS, CLIENT_REQUEST_TIMEOUT_MS } from '../src/ai/anthropic.ts';
import { buildFullModelPayload } from '../src/ai/fullModel.ts';
import { parseAGBText } from '../src/domain/importModel.ts';
import { computeModelEvidence } from '../src/domain/modelEvidence.ts';
import { createAIHost } from './ai-host.mjs';
const context = { scope: 'model', scoringStatus: 'unverified-preview', names: 'omitted', profileValues: 'omitted', facts: { trees: 1, predictors: 1, nodes: 3, deepestPathLevels: 2 } };
const payload = () => buildProviderPayload('copilot', 'auto', context);
test('cold runtime uses a bounded 90-second deadline with client cleanup headroom and private-free stages', async () => {
  assert.equal(REQUEST_TIMEOUT_MS, 90000);
  assert.equal(CLIENT_REQUEST_TIMEOUT_MS, 145000);
  const stages = [];
  const sdk = mock();
  const client = sdk.factory({});
  const session = await client.createSession({});
  session.sendAndWait = async (_message, timeout) => {
    assert.equal(timeout, REQUEST_TIMEOUT_MS);
    return { data: { content: 'PRIVATE_OUTPUT_SENTINEL' } };
  };
  await runCopilot(payload(), new AbortController().signal, {
    token: 'PRIVATE_TOKEN_SENTINEL', clientFactory: options => sdk.factory(options), onStage: stage => stages.push(stage),
  });
  assert.deepEqual(stages, ['runtime-start', 'authentication', 'session-create', 'inference', 'cleanup']);
  assert.ok(sdk.options.sessionIdleTimeoutSeconds >= CLIENT_REQUEST_TIMEOUT_MS / 1000);
  assert.ok(!JSON.stringify(stages).includes('PRIVATE'));
});
function mock({ hang = false, authenticated = true } = {}) {
  const events = []; let options; let config; let listener;
  const session = {
    sessionId: 'mock', on(callback) { listener = callback; return () => {}; },
    async sendAndWait(message) { events.push(['send', message]); if (hang) return new Promise(() => {}); return { data: { content: 'Unverified commentary.' } }; },
    async abort() { events.push(['abort']); },
    async disconnect() { events.push(['disconnect']); },
  };
  const client = {
    async start() { events.push(['start']); },
    async getAuthStatus() { return { isAuthenticated: authenticated }; },
    async createSession(value) { config = value; events.push(['session']); return session; },
    async deleteSession() { events.push(['delete']); },
    async stop() { events.push(['stop']); return []; },
    async forceStop() { events.push(['forceStop']); },
  };
  return { events, get options() { return options; }, get config() { return config; }, emit: event => listener?.(event),
    factory(value) { options = value; return client; } };
}
test('isolated empty SDK has no tools, ambient config, secrets, discovery, telemetry or durable shared store', async () => {
  const sdk = mock();
  const text = await runCopilot(payload(), new AbortController().signal, { token: 'mock-not-a-token', clientFactory: sdk.factory });
  assert.equal(text, 'Unverified commentary.');
  assert.equal(sdk.options.mode, 'empty');
  assert.equal(sdk.options.connection.kind, 'stdio');
  assert.equal(sdk.options.telemetry, undefined);
  assert.equal(sdk.options.env.COPILOT_OTEL_ENABLED, 'false');
  assert.equal(sdk.options.useLoggedInUser, false);
  assert.equal(sdk.options.gitHubToken, 'mock-not-a-token');
  assert.ok(!existsSync(sdk.options.baseDirectory));
  assert.notEqual(sdk.options.workingDirectory, process.cwd());
  assert.deepEqual(sdk.config.availableTools, []);
  assert.deepEqual(sdk.config.excludedTools, ['builtin:*', 'mcp:*', 'custom:*']);
  assert.deepEqual(sdk.config.mcpServers, {});
  assert.equal(sdk.config.enableSkills, false);
  assert.equal(sdk.config.enableConfigDiscovery, false);
  assert.equal(sdk.config.skipCustomInstructions, true);
  assert.equal(sdk.config.enableSessionStore, false);
  assert.equal(sdk.config.enableSessionTelemetry, false);
  assert.equal(sdk.config.remoteSession, 'off');
  assert.deepEqual(sdk.config.systemMessage, payload().systemMessage);
  assert.equal(sdk.config.onPermissionRequest({ kind: 'shell' }).kind, 'denied-interactively-by-user');
  assert.equal(sdk.config.hooks.onPreToolUse({}).permissionDecision, 'deny');
  assert.equal(sdk.config.hooks.onErrorOccurred({}).errorHandling, 'abort');
  assert.deepEqual(sdk.events.map(event => event[0]), ['start', 'session', 'send', 'disconnect', 'delete', 'stop']);
});
test('cancellation before an operation does not start an unobserved SDK promise', async () => {
  const sdk = mock();
  const controller = new AbortController();
  await assert.rejects(runCopilot(payload(), controller.signal, { token: 'mock', clientFactory: options => {
    const client = sdk.factory(options);
    controller.abort();
    return client;
  } }));
  assert.ok(!sdk.events.some(event => event[0] === 'start'));
  assert.ok(sdk.events.some(event => event[0] === 'stop'));
  assert.ok(!existsSync(sdk.options.baseDirectory));
});
test('child environment excludes all ambient auth/provider/instruction/telemetry variables', () => {
  const env = childEnvironment({ PATH: 'safe', SystemRoot: 'windows', HOME: 'realhome', GH_TOKEN: 'work', GITHUB_TOKEN: 'work', ANTHROPIC_API_KEY: 'private', COPILOT_API_URL: 'evil', COPILOT_HOME: 'ambient', OTEL_EXPORTER_OTLP_ENDPOINT: 'evil' }, 'isolated');
  assert.equal(env.PATH, 'safe');
  assert.equal(env.HOME, 'isolated');
  for (const key of ['GH_TOKEN', 'GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'COPILOT_API_URL', 'COPILOT_HOME', 'OTEL_EXPORTER_OTLP_ENDPOINT']) assert.equal(env[key], undefined);
});
test('missing auth never sends and failed sessions never fall back', async () => {
  const sdk = mock({ authenticated: false });
  await assert.rejects(runCopilot(payload(), new AbortController().signal, { token: 'mock', clientFactory: sdk.factory }), error => error.code === 'auth');
  assert.ok(!sdk.events.some(event => event[0] === 'send'));
  assert.ok(sdk.events.some(event => event[0] === 'stop'));
  assert.ok(!existsSync(sdk.options.baseDirectory));
});
test('abort closes owned SDK session/client and deletes only its isolated state', async () => {
  const sdk = mock({ hang: true }); const controller = new AbortController();
  const request = runCopilot(payload(), controller.signal, { token: 'mock', clientFactory: sdk.factory });
  while (!sdk.events.some(event => event[0] === 'send')) await new Promise(resolve => setTimeout(resolve, 5));
  controller.abort();
  await assert.rejects(request);
  assert.ok(sdk.events.some(event => event[0] === 'abort'));
  assert.ok(sdk.events.some(event => event[0] === 'delete'));
  assert.ok(sdk.events.some(event => event[0] === 'stop'));
  assert.ok(!existsSync(sdk.options.baseDirectory));
});
test('SDK rate/auth/quota/timeout errors are mapped without private diagnostics or automatic fallback', async () => {
  for (const [errorType, statusCode, expected] of [['rate_limit', 429, 'rate'], ['auth', 401, 'auth'], ['quota', 402, 'billing'], ['network', 504, 'timeout'], ['unknown', 529, 'provider']]) {
    const sdk = mock({ hang: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 500);
    const request = runCopilot(payload(), controller.signal, { token: 'mock', clientFactory: sdk.factory });
    while (!sdk.events.some(event => event[0] === 'send')) await new Promise(resolve => setTimeout(resolve, 5));
    sdk.emit({ type: 'session.error', data: { errorType, statusCode, message: 'private credential and context' } });
    await assert.rejects(request, error => error.code === expected && !error.message.includes('private credential'));
    clearTimeout(timer);
    assert.equal(sdk.events.filter(event => event[0] === 'send').length, 1);
  }
});
test('SDK context limits are distinct from credentials and only fixed session error metadata is logged', async () => {
  for (const [errorType, statusCode, expectedCode, expectedDetail] of [
    ['context_limit', undefined, 'context', 'session-context-limit'],
    ['query', 413, 'context', 'session-http-413'],
    ['query', 400, 'provider', 'session-http-400'],
    ['PRIVATE_TYPE_SENTINEL', 503, 'provider', 'session-http-503'],
    ['PRIVATE_TYPE_SENTINEL', 987654, 'provider', 'session-error'],
  ]) {
    const sdk = mock({ hang: true });
    const failures = [];
    const request = runCopilot(payload(), new AbortController().signal, {
      token: 'mock', clientFactory: sdk.factory, onFailure: (...values) => failures.push(values),
    });
    while (!sdk.events.some(event => event[0] === 'send')) await new Promise(resolve => setTimeout(resolve, 5));
    sdk.emit({ type: 'session.error', data: {
      errorType, statusCode, message: 'PRIVATE_MESSAGE_SENTINEL', stack: 'PRIVATE_STACK_SENTINEL',
      errorCode: 'PRIVATE_CODE_SENTINEL', providerErrorParam: 'PRIVATE_PARAMETER_SENTINEL',
      providerCallId: 'PRIVATE_ID_SENTINEL', url: 'https://private.example',
    } });
    await assert.rejects(request, error => error.code === expectedCode);
    assert.deepEqual(failures, [['request', expectedCode, expectedDetail]]);
    assert.ok(!JSON.stringify(failures).includes('PRIVATE'));
    assert.equal(sdk.events.filter(event => event[0] === 'send').length, 1);
    assert.ok(!existsSync(sdk.options.baseDirectory));
  }
});
test('SDK disconnections, exits and idle timeouts do not masquerade as provider authorization failures', async () => {
  for (const [message, expectedCode, expectedDetail] of [
    ['Session disconnected while waiting for a response', 'runtime', 'runtime-connection'],
    ['Session is disconnected', 'runtime', 'runtime-connection'],
    ['Connection is closed.', 'runtime', 'runtime-connection'],
    ['Connection is disposed.', 'runtime', 'runtime-connection'],
    ['Pending response rejected since connection got disposed', 'runtime', 'runtime-connection'],
    ['CLI server exited unexpectedly with code 1', 'runtime', 'runtime-exit'],
    ['CLI server exited with code 1\nstderr: PRIVATE_DIAGNOSTIC_SENTINEL', 'runtime', 'runtime-exit'],
    ['Timeout after 90000ms waiting for session.idle', 'timeout', 'sdk-timeout'],
    ['PRIVATE_DIAGNOSTIC_SENTINEL', 'provider', 'sdk-error'],
  ]) {
    const sdk = mock();
    const failures = [];
    await assert.rejects(runCopilot(payload(), new AbortController().signal, {
      token: 'mock', clientFactory: options => {
        const client = sdk.factory(options);
        const create = client.createSession;
        client.createSession = async config => {
          const session = await create(config);
          session.sendAndWait = async () => { throw new Error(message); };
          return session;
        };
        return client;
      }, onFailure: (...values) => failures.push(values),
    }), error => error.code === expectedCode && !error.message.includes('PRIVATE'));
    assert.deepEqual(failures, [['request', expectedCode, expectedDetail]]);
    assert.ok(!JSON.stringify(failures).includes('PRIVATE'));
    assert.ok(!existsSync(sdk.options.baseDirectory));
  }
});
test('structured session failure takes precedence when SDK event and thrown error settle together', async () => {
  const sdk = mock();
  const failures = [];
  const session = await sdk.factory({}).createSession({});
  session.sendAndWait = async () => {
    sdk.emit({ type: 'session.error', data: { errorType: 'context_limit', message: 'PRIVATE_PROVIDER_SENTINEL' } });
    throw new Error('PRIVATE_SDK_SENTINEL');
  };
  await assert.rejects(runCopilot(payload(), new AbortController().signal, {
    token: 'mock', clientFactory: sdk.factory, onFailure: (...values) => failures.push(values),
  }), error => error.code === 'context');
  assert.deepEqual(failures, [['request', 'context', 'session-context-limit']]);
  assert.ok(!JSON.stringify(failures).includes('PRIVATE'));
  assert.ok(!existsSync(sdk.options.baseDirectory));
});
test('supported error hook preserves pre-wrapper origin without retrying or logging private strings', async () => {
  for (const [error, errorContext, expectedCode, expectedDetail] of [
    ['fetch failed', 'model_call', 'network', 'sdk-network'],
    ['Error: connect ETIMEDOUT PRIVATE_HOST_SENTINEL', 'model_call', 'timeout', 'sdk-timeout'],
    ['Error: socket ECONNRESET PRIVATE_HOST_SENTINEL', 'model_call', 'network', 'sdk-network'],
    ['Session disconnected while waiting for a response', 'system', 'runtime', 'runtime-connection'],
    ['PRIVATE_DIAGNOSTIC_SENTINEL', 'model_call', 'provider', 'hook-model-call'],
    ['PRIVATE_DIAGNOSTIC_SENTINEL', 'system', 'provider', 'hook-system'],
    ['PRIVATE_DIAGNOSTIC_SENTINEL', 'user_input', 'provider', 'hook-user-input'],
    ['PRIVATE_DIAGNOSTIC_SENTINEL', 'PRIVATE_CONTEXT_SENTINEL', 'provider', 'hook-error'],
  ]) {
    const sdk = mock();
    const failures = [];
    const session = await sdk.factory({}).createSession({});
    session.sendAndWait = async () => {
      const action = await sdk.config.hooks.onErrorOccurred({
        error, errorContext, recoverable: true, timestamp: 0, workingDirectory: 'PRIVATE_PATH_SENTINEL',
      }, { sessionId: 'PRIVATE_SESSION_SENTINEL' });
      assert.deepEqual(action, { errorHandling: 'abort', retryCount: 0, suppressOutput: true });
      sdk.emit({ type: 'session.error', data: { errorType: 'query', message: 'PRIVATE_WRAPPER_SENTINEL' } });
      throw new Error('PRIVATE_EXCEPTION_SENTINEL');
    };
    await assert.rejects(runCopilot(payload(), new AbortController().signal, {
      token: 'mock', clientFactory: sdk.factory, onFailure: (...values) => failures.push(values),
    }), error => error.code === expectedCode);
    assert.deepEqual(failures, [['request', expectedCode, expectedDetail]]);
    assert.ok(!JSON.stringify(failures).includes('PRIVATE'));
    assert.ok(!existsSync(sdk.options.baseDirectory));
  }
});
test('specific session errors override generic error-hook origin and do not classify model-like arbitrary text', async () => {
  for (const [hookError, sessionError, expectedCode, detail] of [
    ['PRIVATE_MESSAGE', { errorType: 'authorization', statusCode: 403, message: 'PRIVATE_MESSAGE' }, 'auth', 'session-http-403'],
    ['fetch failed', { errorType: 'context_limit', message: 'PRIVATE_MESSAGE' }, 'context', 'session-context-limit'],
    ['PRIVATE_MESSAGE', { errorType: 'query', message: 'Session disconnected while waiting for a response' }, 'runtime', 'runtime-connection'],
    ['PRIVATE_MESSAGE', { errorType: 'query', message: 'PRIVATE_MESSAGE fetch failed PRIVATE_MESSAGE' }, 'provider', 'hook-model-call'],
  ]) {
    const sdk = mock();
    const failures = [];
    const session = await sdk.factory({}).createSession({});
    session.sendAndWait = async () => {
      await sdk.config.hooks.onErrorOccurred({ error: hookError, errorContext: 'model_call' }, {});
      sdk.emit({ type: 'session.error', data: sessionError });
      return { data: { content: 'Do not return this output after failure.' } };
    };
    await assert.rejects(runCopilot(payload(), new AbortController().signal, {
      token: 'mock', clientFactory: sdk.factory, onFailure: (...values) => failures.push(values),
    }), error => error.code === expectedCode);
    assert.deepEqual(failures, [['request', expectedCode, detail]]);
    assert.ok(!JSON.stringify(failures).includes('PRIVATE'));
  }
});
test('hook-only failure cannot publish output or disappear behind a generic thrown exception', async () => {
  for (const returnsOutput of [false, true]) {
    const sdk = mock();
    const failures = [];
    const session = await sdk.factory({}).createSession({});
    session.sendAndWait = async () => {
      await sdk.config.hooks.onErrorOccurred({ error: 'fetch failed', errorContext: 'model_call' }, {});
      if (returnsOutput) return { data: { content: 'Do not publish output following an error hook.' } };
      throw new Error('PRIVATE_EXCEPTION_SENTINEL');
    };
    await assert.rejects(runCopilot(payload(), new AbortController().signal, {
      token: 'mock', clientFactory: sdk.factory, onFailure: (...values) => failures.push(values),
    }), error => error.code === 'network');
    assert.deepEqual(failures, [['request', 'network', 'sdk-network']]);
    assert.ok(!existsSync(sdk.options.baseDirectory));
  }
});
test('unexpected SDK tool activity or oversized streaming is aborted and never rendered', async () => {
  for (const event of [{ type: 'tool.execution_start', data: {} }, { type: 'assistant.message_delta', data: { deltaContent: 'x'.repeat(33000) } }]) {
    const sdk = mock({ hang: true });
    const request = runCopilot(payload(), new AbortController().signal, { token: 'mock', clientFactory: sdk.factory });
    while (!sdk.events.some(event => event[0] === 'send')) await new Promise(resolve => setTimeout(resolve, 5));
    sdk.emit(event);
    await assert.rejects(request);
    assert.ok(sdk.events.some(value => value[0] === 'abort'));
    assert.ok(!existsSync(sdk.options.baseDirectory));
  }
});
test('cancellation during SDK startup/auth/session creation observes late rejection, stops runtime and never sends', async () => {
  for (const phase of ['start', 'getAuthStatus', 'createSession']) {
    const sdk = mock(); const controller = new AbortController();
    let entered = false; let rejectPending;
    const request = runCopilot(payload(), controller.signal, { token: 'mock', clientFactory: options => {
      const client = sdk.factory(options);
      const stop = client.stop;
      client[phase] = async () => { entered = true; return new Promise((_, reject) => { rejectPending = reject; }); };
      client.stop = async () => { rejectPending?.(new Error('mock late SDK rejection')); return stop(); };
      return client;
    } });
    while (!entered) await new Promise(resolve => setTimeout(resolve, 5));
    controller.abort();
    await assert.rejects(request, error => error.code === 'cancelled');
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(!sdk.events.some(event => event[0] === 'send'));
    assert.ok(sdk.events.some(event => event[0] === 'stop'));
    assert.ok(!existsSync(sdk.options.baseDirectory));
  }
});
test('failed graceful stop force-stops only the owned client before ephemeral state removal', async () => {
  const sdk = mock();
  await runCopilot(payload(), new AbortController().signal, { token: 'mock', clientFactory: options => {
    const client = sdk.factory(options);
    client.stop = async () => [new Error('mock private runtime diagnostic')];
    return client;
  } });
  assert.ok(sdk.events.some(event => event[0] === 'forceStop'));
  assert.ok(!existsSync(sdk.options.baseDirectory));
});
test('a legitimate SDK shutdown longer than two seconds is awaited, not force-killed', async () => {
  const sdk = mock();
  await runCopilot(payload(), new AbortController().signal, { token: 'mock', clientFactory: options => {
    const client = sdk.factory(options);
    client.stop = async () => { await new Promise(resolve => setTimeout(resolve, 2200)); sdk.events.push(['stop']); return []; };
    return client;
  } });
  assert.ok(sdk.events.some(event => event[0] === 'stop'));
  assert.ok(!sdk.events.some(event => event[0] === 'forceStop'));
  assert.ok(!existsSync(sdk.options.baseDirectory));
});
test('successful runtime leaves unused cleanup budget for Windows state removal beyond five seconds', async () => {
  const sdk = mock();
  const failures = [];
  let removalFinished = false;
  const result = await runCopilot(payload(), new AbortController().signal, {
    token: 'mock', clientFactory: sdk.factory, onFailure: (...values) => failures.push(values),
    removeState: async (path, options) => {
      await new Promise(resolve => setTimeout(resolve, 5500));
      const { rm } = await import('node:fs/promises');
      await rm(path, options);
      removalFinished = true;
    },
  });
  assert.equal(result, 'Unverified commentary.');
  assert.equal(removalFinished, true);
  assert.deepEqual(failures, []);
  assert.ok(!existsSync(sdk.options.baseDirectory));
});
test('expired overall cleanup budget never starts an unobserved state removal', async t => {
  const sdk = mock();
  const failures = [];
  let now = 0; let removals = 0;
  t.mock.method(performance, 'now', () => now);
  try {
    await assert.rejects(runCopilot(payload(), new AbortController().signal, {
      token: 'mock', clientFactory: options => {
        const client = sdk.factory(options);
        client.stop = async () => { now = 50_000; return []; };
        return client;
      },
      removeState: async () => { removals++; },
      onFailure: (...values) => failures.push(values),
    }), error => error.code === 'cleanup');
    assert.equal(removals, 0);
    assert.deepEqual(failures, [['state-removal', 'cleanup', 'state-timeout']]);
  } finally {
    t.mock.restoreAll();
    const { rm } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await rm(dirname(sdk.options.baseDirectory), { recursive: true, force: true });
  }
});
test('state removal cannot reuse cleanup time already spent shutting down the runtime', { timeout: 2000 }, async t => {
  const sdk = mock();
  const failures = [];
  let now = 0; let removals = 0;
  t.mock.method(performance, 'now', () => now);
  try {
    await assert.rejects(runCopilot(payload(), new AbortController().signal, {
      token: 'mock', clientFactory: options => {
        const client = sdk.factory(options);
        client.stop = async () => { now = 49_980; return []; };
        return client;
      },
      removeState: async () => { removals++; return new Promise(() => {}); },
      onFailure: (...values) => failures.push(values),
    }), error => error.code === 'cleanup');
    assert.equal(removals, 1);
    assert.deepEqual(failures, [['state-removal', 'cleanup', 'state-timeout']]);
  } finally {
    t.mock.restoreAll();
    const { rm } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await rm(dirname(sdk.options.baseDirectory), { recursive: true, force: true });
  }
});
test('HTTP inference deadline does not discard a valid reply while bounded cleanup finishes', async () => {
  const sdk = mock();
  const records = [];
  const host = createAIHost({
    copilotToken: 'mock-only', timeoutMs: 150,
    onDiagnostic: record => records.push(record),
    copilotClientFactory: options => {
      const client = sdk.factory(options);
      client.stop = async () => { await new Promise(resolve => setTimeout(resolve, 350)); return []; };
      return client;
    },
  });
  await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${host.server.address().port}`;
  try {
    const status = await (await fetch(`${origin}/api/ai/status`, { headers: { 'X-AGB-UI': '1' } })).json();
    const response = await fetch(`${origin}/api/ai/commentary`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-AGB-CSRF': status.csrf },
      body: JSON.stringify({ provider: 'copilot', payload: payload(), approved: true, profileApproved: false }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { text: 'Unverified commentary.' });
    assert.ok(records.some(record => record.stage === 'cleanup'));
    assert.ok(!records.some(record => record.event === 'deadline'));
  } finally { await host.close(); }
});
test('full-model input truncation and incomplete SDK finish metadata never publish an explanation', async () => {
  const raw = readFileSync(new URL('../public/sample/export_PA_WebBuyNow_AGB_sample.json', import.meta.url), 'utf8');
  const bytes = Buffer.byteLength(raw);
  const { model } = parseAGBText(raw, bytes);
  assert.ok(model);
  const full = buildFullModelPayload('copilot', 'auto', computeModelEvidence(model, bytes));
  for (const event of [
    { type: 'session.truncation', data: {} },
    { type: 'assistant.usage', data: { finishReason: 'length' } },
    { type: 'assistant.usage', data: { finishReason: 'content_filter' } },
    { type: 'assistant.usage', data: { finishReason: 'tool_calls' } },
  ]) {
    const sdk = mock();
    const session = await sdk.factory({}).createSession({});
    session.sendAndWait = async () => {
      sdk.emit(event);
      return { data: { content: 'Partial model explanation.' } };
    };
    await assert.rejects(runCopilot(full, new AbortController().signal, { token: 'mock-only', clientFactory: sdk.factory }), error => error.code === 'response');
    assert.ok(sdk.events.some(value => value[0] === 'abort'));
    assert.ok(!existsSync(sdk.options.baseDirectory));
  }
});
test('SDK zero-removal truncation statistics and natural completion do not reject a complete reply', async () => {
  const sdk = mock();
  const session = await sdk.factory({}).createSession({});
  session.sendAndWait = async () => {
    sdk.emit({ type: 'session.truncation', data: {
      tokensRemovedDuringTruncation: 0, messagesRemovedDuringTruncation: 0,
      preTruncationTokensInMessages: 10, postTruncationTokensInMessages: 10,
      preTruncationMessagesLength: 1, postTruncationMessagesLength: 1,
    } });
    sdk.emit({ type: 'assistant.usage', data: { finishReason: 'stop' } });
    return { data: { content: 'Complete unverified reply.' } };
  };
  assert.equal(await runCopilot(payload(), new AbortController().signal, { token: 'mock-only', clientFactory: sdk.factory }), 'Complete unverified reply.');
});
test('failed abort still attempts graceful stop and retries Windows state removal without losing the primary error', async () => {
  const sdk = mock({ authenticated: true, hang: true });
  const controller = new AbortController();
  let removalOptions;
  const request = runCopilot(payload(), controller.signal, {
    token: 'mock', clientFactory: options => {
      const client = sdk.factory(options);
      const mockSession = client.createSession.bind(client);
      client.createSession = async config => {
        const session = await mockSession(config);
        session.abort = async () => { throw new Error('PRIVATE_ABORT_DIAGNOSTIC'); };
        return session;
      };
      return client;
    },
    removeState: async (path, options) => {
      removalOptions = options;
      const { rm } = await import('node:fs/promises');
      await rm(path, options);
    },
  });
  while (!sdk.events.some(event => event[0] === 'send')) await new Promise(resolve => setTimeout(resolve, 5));
  controller.abort();
  await assert.rejects(request, error => error.code === 'cancelled');
  assert.ok(sdk.events.some(event => event[0] === 'stop'));
  assert.deepEqual(removalOptions, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  assert.ok(!existsSync(sdk.options.baseDirectory));
});
