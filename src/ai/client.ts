import { ANTHROPIC, CLIENT_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS, CommentaryError, isErrorCode, readBoundedJSON } from './anthropic';
import { COPILOT, isProvider } from './providers';
import type { ProviderId, ProviderPayload } from './providers';
import { COMMENTARY_CONTRACT_VERSION } from './auditPrompt';

export interface ProviderStatus { id: ProviderId; configured: boolean; blocked: 'cleanup' | null; model: string; authSource: string; destination: string }
export interface AIStatus { defaultProvider: ProviderId; providers: ProviderStatus[]; csrf: string; requestTimeoutMs: number }
const endpoint = (path: string) => `${import.meta.env.BASE_URL}api/ai/${path}`;
async function localRequest(path: string, init: RequestInit, signal: AbortSignal, timeout: number, responseBytes?: number): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
  try {
    signal.throwIfAborted();
    const response = await fetch(endpoint(path), { ...init, signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
    const body = await readBoundedJSON(response, responseBytes);
    if (!response.ok) {
      const code = body && typeof body === 'object' && 'code' in body ? body.code : undefined;
      throw new CommentaryError(isErrorCode(code) ? code : 'network');
    }
    return body;
  } catch (cause) {
    if (controller.signal.aborted || signal.aborted) throw new CommentaryError(timedOut ? 'timeout' : 'cancelled');
    throw cause instanceof CommentaryError ? cause : new CommentaryError('network');
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}
export async function loadAIStatus(signal: AbortSignal): Promise<AIStatus> {
  const body = await localRequest('status', { headers: { 'X-AGB-UI': '1' } }, signal, 5000);
  if (body && typeof body === 'object' && (!('commentaryContract' in body) || body.commentaryContract !== COMMENTARY_CONTRACT_VERSION || !('requestTimeoutMs' in body) || body.requestTimeoutMs !== REQUEST_TIMEOUT_MS)) throw new CommentaryError('restart');
  if (!body || typeof body !== 'object' || !('defaultProvider' in body) || body.defaultProvider !== 'copilot' || !('csrf' in body) || typeof body.csrf !== 'string' || !/^[a-f0-9]{64}$/.test(body.csrf) || !('providers' in body) || !Array.isArray(body.providers) || body.providers.length !== 2) throw new CommentaryError('response');
  const providers: ProviderStatus[] = [];
  for (const entry of body.providers) {
    if (!entry || typeof entry !== 'object' || !isProvider(entry.id) || providers.some(item => item.id === entry.id) || typeof entry.configured !== 'boolean' || entry.blocked !== null && entry.blocked !== 'cleanup' || entry.id === 'anthropic' && entry.blocked !== null || typeof entry.model !== 'string' || typeof entry.authSource !== 'string' || entry.authSource.length > 160 || entry.destination !== (entry.id === 'copilot' ? COPILOT.destination : ANTHROPIC.endpoint) || !(entry.id === 'copilot' ? entry.model === 'auto' : ANTHROPIC.models.some(model => model === entry.model))) throw new CommentaryError('response');
    providers.push({ id: entry.id, configured: entry.configured, blocked: entry.blocked, model: entry.model, authSource: entry.authSource, destination: entry.destination });
  }
  return { defaultProvider: 'copilot', providers, csrf: body.csrf, requestTimeoutMs: REQUEST_TIMEOUT_MS };
}
export async function requestCommentary(status: AIStatus, provider: ProviderId, payload: ProviderPayload, profileApproved: boolean, signal: AbortSignal): Promise<string> {
  if (!status.providers.find(entry => entry.id === provider)?.configured) throw new CommentaryError('configuration');
  if (status.providers.find(entry => entry.id === provider)?.blocked) throw new CommentaryError('cleanup');
  const body = await localRequest('commentary', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AGB-CSRF': status.csrf },
    body: JSON.stringify({ provider, payload, approved: true, profileApproved }),
  }, signal, CLIENT_REQUEST_TIMEOUT_MS);
  if (!body || typeof body !== 'object' || !('text' in body) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 8000) throw new CommentaryError('response');
  return body.text;
}

export async function requestModelExplanation(status: AIStatus, provider: ProviderId, approvedBody: Blob, signal: AbortSignal): Promise<string> {
  const selected = status.providers.find(entry => entry.id === provider);
  if (!selected?.configured) throw new CommentaryError('configuration');
  if (selected.blocked) throw new CommentaryError('cleanup');
  const body = await localRequest('model-explanation', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AGB-CSRF': status.csrf },
    body: approvedBody,
  }, signal, CLIENT_REQUEST_TIMEOUT_MS, 262_144);
  if (!body || typeof body !== 'object' || !('text' in body) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 32_000 || new TextEncoder().encode(body.text).byteLength > 128_000) throw new CommentaryError('response');
  return body.text;
}
