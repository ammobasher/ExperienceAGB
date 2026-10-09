import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIError, buildPayload, GITHUB_MODELS, MAX_BODY_BYTES, requestCommentary } from './githubModels';
import { testHistoricalTransport } from './githubModels.testSupport';
const payload = buildPayload('owner/model', { scope: 'tree', facts: { nodes: 3 } });
const response = (content = 'Unverified commentary.') => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { headers: { 'content-type': 'application/json' } });
afterEach(() => { vi.unstubAllGlobals(); });
describe('retirement hard gate', () => {
  it('cannot send even with browser fetch available', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(requestCommentary()).rejects.toMatchObject({ code: 'retired' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
describe('historical transport defenses with injected mocks only', () => {
  it('sends exactly previewed body only to fixed destination, no cookies/redirects', async () => {
    const transport = vi.fn().mockResolvedValue(response());
    expect(await testHistoricalTransport({ transport, token: 'test_token', payload, approved: true })).toBe('Unverified commentary.');
    expect(transport).toHaveBeenCalledWith(GITHUB_MODELS.endpoint, expect.objectContaining({ body: JSON.stringify(payload), credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', headers: expect.objectContaining({ Authorization: 'Bearer test_token' }) }));
  });
  it('rejects missing token and consent before any transport', async () => {
    const transport = vi.fn();
    await expect(testHistoricalTransport({ transport, token: '', payload, approved: true })).rejects.toMatchObject({ code: 'token' });
    await expect(testHistoricalTransport({ transport, token: 'test_token', payload, approved: false })).rejects.toMatchObject({ code: 'consent' });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([[401, 'auth'], [403, 'auth'], [429, 'rate'], [500, 'provider']])('maps %s without exposing raw response or retrying', async (status, code) => {
    const transport = vi.fn().mockResolvedValue(new Response('private raw error test_token', { status: Number(status) }));
    await expect(testHistoricalTransport({ transport, token: 'test_token', payload, approved: true })).rejects.toMatchObject({ code });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('hides raw network exceptions', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('private test_token'));
    const error = await testHistoricalTransport({ transport, token: 'test_token', payload, approved: true }).catch(error => error);
    expect(error).toBeInstanceOf(AIError);
    expect(error.message).not.toContain('test_token');
  });
  it('times out even if fetch ignores abort', async () => {
    const transport = vi.fn(() => new Promise<Response>(() => {}));
    await expect(testHistoricalTransport({ transport, token: 'test_token', payload, approved: true, timeoutMs: 5 })).rejects.toMatchObject({ code: 'timeout' });
  });
  it('cancels pending request and rejects already-aborted requests before transport', async () => {
    const controller = new AbortController();
    const transport = vi.fn(() => new Promise<Response>(() => {}));
    const pending = testHistoricalTransport({ transport, token: 'test_token', payload, approved: true, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    transport.mockClear();
    await expect(testHistoricalTransport({ transport, token: 'test_token', payload, approved: true, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['event-stream', 'length', 'chunked', 'invalid-json', 'output-size'])('rejects %s without rendering uncontrolled output', async mode => {
    let value: Response;
    if (mode === 'event-stream') value = new Response('data: secret', { headers: { 'content-type': 'text/event-stream' } });
    else if (mode === 'length') value = new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(MAX_BODY_BYTES + 1) } });
    else if (mode === 'chunked') value = new Response('x'.repeat(MAX_BODY_BYTES + 1), { headers: { 'content-type': 'application/json' } });
    else if (mode === 'invalid-json') value = new Response('private', { headers: { 'content-type': 'application/json' } });
    else value = response('x'.repeat(8_001));
    await expect(testHistoricalTransport({ transport: vi.fn().mockResolvedValue(value), token: 'test_token', payload, approved: true })).rejects.toBeInstanceOf(AIError);
  });
  it('bounds stalled response streams with timeout', async () => {
    const value = new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } });
    await expect(testHistoricalTransport({ transport: vi.fn().mockResolvedValue(value), token: 'test_token', payload, approved: true, timeoutMs: 5 })).rejects.toMatchObject({ code: 'timeout' });
  });
});
