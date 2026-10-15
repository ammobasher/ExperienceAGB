import { ANTHROPIC, CommentaryError, MAX_REQUEST_BYTES, SYSTEM, buildAnthropicPayload, validateContext, validateSubmission } from './anthropic.ts';
import type { AnthropicPayload } from './anthropic.ts';

export const COPILOT = {
  provider: 'GitHub Copilot',
  destination: 'GitHub Copilot via official SDK / owned local CLI (GitHub-managed model routing)',
  defaultModel: 'auto',
  models: ['auto'],
  source: 'https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md',
} as const;
export type ProviderId = 'copilot' | 'anthropic';
export function isProvider(value: unknown): value is ProviderId { return value === 'copilot' || value === 'anthropic'; }
const PREFIX = 'Explain these allowlisted facts only:\n';
export function buildCopilotPayload(model: string, context: unknown) {
  if (model !== 'auto') throw new CommentaryError('request');
  const payload = { model, systemMessage: { mode: 'replace' as const, content: SYSTEM }, prompt: PREFIX + JSON.stringify(validateContext(context)) };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_REQUEST_BYTES) throw new CommentaryError('oversized');
  return payload;
}
export type CopilotPayload = ReturnType<typeof buildCopilotPayload>;
export type ProviderPayload = CopilotPayload | AnthropicPayload;
export function buildProviderPayload(provider: ProviderId, model: string, context: unknown): ProviderPayload {
  return provider === 'copilot' ? buildCopilotPayload(model, context) : buildAnthropicPayload(model, context);
}
export function validateProviderSubmission(value: unknown): { provider: ProviderId; payload: ProviderPayload } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CommentaryError('request');
  const body = value as Record<string, unknown>;
  if (!isProvider(body.provider) || Object.keys(body).sort().join(',') !== 'approved,payload,profileApproved,provider') throw new CommentaryError('request');
  if (body.provider === 'anthropic') {
    return { provider: 'anthropic', payload: validateSubmission({ payload: body.payload, approved: body.approved, profileApproved: body.profileApproved }) };
  }
  if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) throw new CommentaryError('request');
  const payload = body.payload as Record<string, unknown>;
  if (Object.keys(payload).sort().join(',') !== 'model,prompt,systemMessage' || typeof payload.prompt !== 'string' || !payload.prompt.startsWith(PREFIX)) throw new CommentaryError('request');
  let context: unknown;
  try { context = JSON.parse(payload.prompt.slice(PREFIX.length)); } catch { throw new CommentaryError('request'); }
  // Reuse the same independent field and profile-consent checks for both providers.
  validateSubmission({ payload: buildAnthropicPayload(ANTHROPIC.defaultModel, context), approved: body.approved, profileApproved: body.profileApproved });
  const expected = buildCopilotPayload(String(payload.model), context);
  if (JSON.stringify(expected) !== JSON.stringify(payload)) throw new CommentaryError('request');
  return { provider: 'copilot', payload: expected };
}
