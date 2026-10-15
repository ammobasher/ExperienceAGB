import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPreviewHost, securityHeaders } from './preview-host.mjs';
import {
  ANTHROPIC, CommentaryError, ERROR_MESSAGES, MAX_REQUEST_BYTES,
  REQUEST_TIMEOUT_MS, readBoundedJSON, readCommentary,
} from '../src/ai/anthropic.ts';
import { COPILOT, validateProviderSubmission } from '../src/ai/providers.ts';
import { runCopilot } from './copilot.ts';
import { COMMENTARY_CONTRACT_VERSION } from '../src/ai/auditPrompt.ts';
import { MAX_FULL_REQUEST_BYTES, validateFullModelSubmission } from '../src/ai/fullModel.ts';

function readBody(request, maxBytes = MAX_REQUEST_BYTES, timeoutMs = 3000, signal) {
  return new Promise((resolveBody, reject) => {
    let bytes = 0;
    let settled = false;
    const chunks = [];
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request.off('data', data); request.off('end', end); request.off('aborted', failed);
      signal?.removeEventListener('abort', failed);
      chunks.length = 0;
      if (error) { request.pause(); reject(error); } else resolveBody(value);
    };
    const data = chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) finish(new CommentaryError('oversized'));
      else chunks.push(chunk);
    };
    const end = () => {
      try { finish(null, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
      catch { finish(new CommentaryError('request')); }
    };
    const failed = () => finish(new CommentaryError('cancelled'));
    const closed = () => {
      failed();
      request.off('error', failed);
    };
    const timer = setTimeout(() => finish(new CommentaryError('timeout')), timeoutMs);
    request.on('data', data); request.once('end', end); request.once('error', failed); request.once('aborted', failed);
    request.once('close', closed);
    signal?.addEventListener('abort', failed, { once: true });
    if (signal?.aborted || request.aborted || request.destroyed) failed();
  });
}
function safeToken(received, expected) {
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  const bytes = Buffer.from(received);
  return bytes.length === expected.length && timingSafeEqual(bytes, Buffer.from(expected));
}
export function createAIHost({
  root = resolve('dist'), base = '/', apiKey = '', model = ANTHROPIC.defaultModel,
  uiOrigin, fetchImpl = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS, maxConcurrent = 2,
  copilotToken = '', copilotClientFactory,
  onDiagnostic = record => console.info('[AI request]', JSON.stringify(record)),
} = {}) {
  if (!ANTHROPIC.models.includes(model)) throw new Error('Unsupported ANTHROPIC_MODEL. Use a documented allowlisted model.');
  if (uiOrigin && !/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(uiOrigin)) throw new Error('AGB_UI_ORIGIN must be an exact loopback origin.');
  if (typeof apiKey !== 'string' || /[\r\n\0]/.test(apiKey) || apiKey.length > 512) throw new Error('Invalid server API key configuration.');
  if (typeof copilotToken !== 'string' || /[\r\n\0]/.test(copilotToken) || copilotToken.length > 512) throw new Error('Invalid server Copilot credential configuration.');
  const csrf = randomBytes(32).toString('hex');
  const controllers = new Set();
  const pending = new Set();
  const staticHost = createPreviewHost({ root, base });
  const prefix = `${base}api/ai/`;
  let active = 0;
  let copilotBlocked = false;
  const server = createServer(async (request, response) => {
    for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
    const send = (status, body) => {
      if (response.destroyed || response.writableEnded) return;
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(body));
    };
    const reject = (status, code = 'request') => {
      // Rejected bodies are not buffered or drained indefinitely.
      response.setHeader('Connection', 'close');
      send(status, { code, message: ERROR_MESSAGES[code] });
    };
    const authority = `127.0.0.1:${request.socket.localPort}`;
    const origin = `http://${authority}`;
    if (request.headers.host !== authority || request.socket.remoteAddress !== '127.0.0.1') { reject(403); return; }
    if (!request.url?.startsWith(prefix)) { staticHost.emit('request', request, response); return; }
    const browserOrigin = request.headers.origin;
    const allowedOrigin = browserOrigin === origin || (uiOrigin && browserOrigin === uiOrigin);
    if (request.headers['sec-fetch-site'] === 'cross-site' || (browserOrigin !== undefined && !allowedOrigin)) { reject(403); return; }
    if (request.url === `${prefix}status`) {
      if (request.method !== 'GET') { reject(405); return; }
      if (request.headers['x-agb-ui'] !== '1') { reject(403); return; }
      send(200, { defaultProvider: 'copilot', commentaryContract: COMMENTARY_CONTRACT_VERSION, requestTimeoutMs: timeoutMs, csrf, providers: [
        { id: 'copilot', configured: Boolean(copilotToken), blocked: copilotBlocked ? 'cleanup' : null, model: COPILOT.defaultModel, authSource: 'explicit COPILOT_GITHUB_TOKEN (server environment)', destination: COPILOT.destination },
        { id: 'anthropic', configured: Boolean(apiKey), blocked: null, model, authSource: 'ANTHROPIC_API_KEY (server environment)', destination: ANTHROPIC.endpoint },
      ] });
      return;
    }
    const fullModel = request.url === `${prefix}model-explanation`;
    if (!fullModel && request.url !== `${prefix}commentary`) { reject(404); return; }
    if (request.method !== 'POST') { reject(405); return; }
    if (!allowedOrigin || !safeToken(request.headers['x-agb-csrf'], csrf)) { reject(403); return; }
    if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) { reject(415); return; }
    const maxRequestBytes = fullModel ? MAX_FULL_REQUEST_BYTES : MAX_REQUEST_BYTES;
    const length = request.headers['content-length'];
    if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > maxRequestBytes)) { reject(413, 'oversized'); return; }
    if (active >= maxConcurrent) { reject(429, 'busy'); return; }
    active++;
    let finish;
    const completion = new Promise(resolveDone => { finish = resolveDone; });
    pending.add(completion);
    const controller = new AbortController();
    controllers.add(controller);
    let timedOut = false;
    let upstreamStarted = false;
    const requestId = randomBytes(6).toString('hex');
    const startedAt = performance.now();
    let providerId = null;
    let workStage = 'validation';
    let resultCode = 'cancelled';
    const report = (event, stage = workStage, result = null, detail) => onDiagnostic({
      requestId, provider: providerId, event, stage,
      elapsedMs: Math.round(performance.now() - startedAt), result,
      ...(detail === undefined ? {} : { detail }),
    });
    const disconnected = () => { if (!response.writableEnded) controller.abort(); };
    request.once('aborted', disconnected); response.once('close', disconnected);
    const timer = setTimeout(() => { timedOut = true; report('deadline', workStage, 'timeout'); controller.abort(); }, timeoutMs);
    try {
      const body = await readBody(request, maxRequestBytes, fullModel ? 30_000 : 3000, controller.signal);
      const { provider, payload } = fullModel ? validateFullModelSubmission(body) : validateProviderSubmission(body);
      providerId = provider;
      report('stage');
      if (provider === 'copilot' && copilotBlocked) throw new CommentaryError('cleanup');
      if (payload.model !== (provider === 'copilot' ? 'auto' : model)) throw new CommentaryError('request');
      if (provider === 'copilot' ? !copilotToken : !apiKey) throw new CommentaryError('configuration');
      controller.signal.throwIfAborted();
      upstreamStarted = true;
      if (provider === 'copilot') {
        const text = await runCopilot(payload, controller.signal, {
          token: copilotToken, clientFactory: copilotClientFactory,
          onStage: stage => {
            if (stage === 'cleanup') clearTimeout(timer);
            else workStage = stage;
            report('stage', stage);
          },
          onFailure: (operation, code, detail) => report('failure', operation === 'request' ? workStage : `cleanup-${operation}`, code, detail),
        });
        controller.signal.throwIfAborted();
        resultCode = 'success';
        send(200, { text });
        return;
      }
      workStage = 'inference'; report('stage');
      const upstream = await fetchImpl(ANTHROPIC.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC.version },
        body: JSON.stringify(payload), redirect: 'error', credentials: 'omit', signal: controller.signal,
      });
      if (!upstream.ok) {
        await upstream.body?.cancel();
        const codes = { 400: 'request', 401: 'auth', 402: 'billing', 403: 'auth', 404: 'request', 413: 'oversized', 429: 'rate', 504: 'timeout' };
        throw new CommentaryError(codes[upstream.status] ?? 'provider');
      }
      workStage = 'response-read'; report('stage');
      const upstreamBody = await readBoundedJSON(upstream, fullModel ? 262_144 : undefined);
      const text = fullModel ? readCommentary(upstreamBody, 32_000, 128_000) : readCommentary(upstreamBody);
      controller.signal.throwIfAborted();
      resultCode = 'success';
      send(200, { text });
    } catch (cause) {
      const code = cause instanceof CommentaryError && cause.code === 'cleanup' ? 'cleanup' : controller.signal.aborted ? (timedOut ? 'timeout' : 'cancelled') : cause instanceof CommentaryError ? cause.code : 'network';
      resultCode = code;
      if (providerId === 'copilot' && code === 'cleanup') copilotBlocked = true;
      const status = code === 'oversized' && upstreamStarted ? 502 : { configuration: 503, cleanup: 503, request: 400, consent: 400, oversized: 413, timeout: 504, cancelled: 499 }[code] ?? 502;
      reject(status, code);
    } finally {
      controller.abort();
      clearTimeout(timer); controllers.delete(controller); active--;
      request.off('aborted', disconnected); response.off('close', disconnected);
      report('finished', workStage, resultCode);
      finish(); pending.delete(completion);
    }
  });
  server.headersTimeout = 5000; server.requestTimeout = 35_000; server.keepAliveTimeout = 1000; server.maxConnections = 32;
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  return {
    server,
    async close() {
      for (const controller of controllers) controller.abort();
      if (server.listening) {
        const closed = new Promise(resolveClose => server.close(resolveClose));
        server.closeAllConnections();
        await closed;
      }
      await Promise.all(pending);
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.AGB_AI_PORT ?? 5183);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('AGB_AI_PORT must be 1024-65535.');
  const base = process.env.AGB_HOST_BASE ?? '/';
  const host = createAIHost({
    base, apiKey: process.env.ANTHROPIC_API_KEY ?? '', model: process.env.ANTHROPIC_MODEL ?? ANTHROPIC.defaultModel,
    copilotToken: process.env.COPILOT_GITHUB_TOKEN ?? '',
    uiOrigin: process.env.AGB_UI_ORIGIN,
  });
  host.server.on('error', () => { console.error('Local AI host could not start. Check the port and configuration.'); process.exitCode = 1; });
  host.server.listen(port, '127.0.0.1', () => console.log(`Local commentary host: http://127.0.0.1:${port}${base} (default Copilot; credential ${process.env.COPILOT_GITHUB_TOKEN ? 'configured' : 'not configured'}; no inference sent)`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void host.close(); });
}
