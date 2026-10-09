import { AIError, buildPayload, GITHUB_MODELS, MAX_BODY_BYTES, MAX_PAYLOAD_BYTES, TIMEOUT_MS } from './githubModels';
/** Mock-only historical-format defense harness; this module is not imported by the app. */
export async function testHistoricalTransport(options: {
  transport: typeof fetch; token: string; payload: ReturnType<typeof buildPayload>; approved: boolean; signal?: AbortSignal; timeoutMs?: number;
}): Promise<string> {
  if (!options.approved) throw new AIError('consent');
  if (!/^[A-Za-z0-9_]{8,256}$/.test(options.token)) throw new AIError('token');
  if (options.signal?.aborted) throw new AIError('cancelled');
  const body = JSON.stringify(options.payload);
  if (new TextEncoder().encode(body).byteLength > MAX_PAYLOAD_BYTES) throw new AIError('oversized');
  const controller = new AbortController();
  let timedOut = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = () => { controller.abort(); void reader?.cancel().catch(() => {}); };
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  let abortListener: (() => void) | undefined;
  const stopped = new Promise<never>((_, reject) => {
    abortListener = () => reject(new AIError(timedOut ? 'timeout' : 'cancelled'));
    controller.signal.addEventListener('abort', abortListener, { once: true });
    if (controller.signal.aborted) abortListener();
  });
  void stopped.catch(() => {});
  const timer = setTimeout(() => { timedOut = true; cancel(); }, options.timeoutMs ?? TIMEOUT_MS);
  try {
    if (controller.signal.aborted) throw new AIError('cancelled');
    const response = await Promise.race([options.transport(GITHUB_MODELS.endpoint, {
      method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store',
      headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body, signal: controller.signal,
    }), stopped]);
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new AIError(response.status === 429 ? 'rate' : response.status === 401 || response.status === 403 ? 'auth' : 'provider');
    }
    if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) { void response.body?.cancel().catch(() => {}); throw new AIError('response'); }
    const length = Number(response.headers.get('content-length'));
    if (length > MAX_BODY_BYTES) { void response.body?.cancel().catch(() => {}); throw new AIError('oversized'); }
    if (!response.body) throw new AIError('response');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '', bytes = 0;
    while (true) {
      const chunk = await Promise.race([reader.read(), stopped]);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) throw new AIError('oversized');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const parsed = JSON.parse(text);
    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim() || content.length > 8_000) throw new AIError('response');
    return content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  } catch (error) {
    cancel();
    if (error instanceof AIError) throw error;
    if (options.signal?.aborted) throw new AIError('cancelled');
    throw new AIError('network');
  } finally {
    clearTimeout(timer);
    if (abortListener) controller.signal.removeEventListener('abort', abortListener);
    options.signal?.removeEventListener('abort', cancel);
    reader?.releaseLock();
  }
}
