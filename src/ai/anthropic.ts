import { AUDIT_COMMENTARY_PROMPT } from './auditPrompt.ts';
import { validateModelEvidence } from './modelEvidenceValidation.ts';

export const ANTHROPIC = {
  provider: 'Anthropic',
  endpoint: 'https://api.anthropic.com/v1/messages',
  version: '2023-06-01',
  defaultModel: 'claude-haiku-5-5',
  models: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
  source: 'https://platform.claude.com/docs/en/api/overview',
} as const;
export const MAX_REQUEST_BYTES = 12_000;
export const MAX_RESPONSE_BYTES = 65_536;
export const REQUEST_TIMEOUT_MS = 90_000;
export const COPILOT_CLEANUP_TIMEOUT_MS = 50_000;
export const CLIENT_REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS + COPILOT_CLEANUP_TIMEOUT_MS + 5_000;
export const SYSTEM = AUDIT_COMMENTARY_PROMPT;
const PREFIX = 'Explain these allowlisted facts only:\n';
export type AIErrorCode = 'configuration' | 'consent' | 'request' | 'cancelled' | 'timeout' | 'rate' | 'auth' | 'billing' | 'network' | 'provider' | 'context' | 'runtime' | 'oversized' | 'response' | 'busy' | 'restart' | 'cleanup';
export const ERROR_MESSAGES: Record<AIErrorCode, string> = {
  cleanup: 'Local Copilot runtime cleanup failed. Further Copilot requests are blocked until the bridge is restarted and isolated temporary state is resolved. This reports cleanup, not verified credential status; no fallback was used.',
  restart: 'The local bridge uses an older commentary contract. Restart it in the terminal where you configured the provider credential, then recheck configuration.',
  configuration: 'Selected AI provider is not configured. Configure its server-only credential locally and restart the bridge. Never enter credentials in this browser or chat.',
  consent: 'Review and approve this exact request first, including separate profile-value consent.',
  request: 'The request did not match the bounded commentary contract. Refresh context and review again.',
  cancelled: 'Request cancelled. Cancellation cannot recall data already sent or guarantee no provider charge.',
  timeout: 'Request timed out. It may have reached the provider. Review and approve again before manually retrying.',
  rate: 'Provider rate or spend limit reached. Check account limits before a manually approved retry.',
  auth: 'Provider rejected server authorization or model access. Check the selected credential, subscription and organization policy.',
  billing: 'Provider billing is unavailable. Check the selected account.',
  network: 'The local bridge or provider connection failed. No raw network error is shown.',
  provider: 'Generation failed in the selected provider or its local runtime. This error does not establish a credential or entitlement problem. Check the privacy-safe local diagnostics before a manually approved retry. No fallback was used.',
  context: 'The selected provider reported a context or input-size limit for this request. The full model was not shortened or replaced with a selected tree. Provider limits are separate from the app file limit; no automatic retry or fallback was used.',
  runtime: 'The local Copilot runtime exited or its SDK connection closed during the request. No explanation was returned. This does not establish a bad token; check local diagnostics before a manually approved retry. Data already sent cannot be recalled.',
  oversized: 'Request or response exceeded the safe size limit.',
  response: 'Provider returned unsupported or incomplete commentary. No output was used.',
  busy: 'The local bridge is busy. Wait before approving another request.',
};
export class CommentaryError extends Error {
  readonly code: AIErrorCode;
  constructor(code: AIErrorCode) { super(ERROR_MESSAGES[code]); this.code = code; }
}
export function isErrorCode(value: unknown): value is AIErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_MESSAGES, value);
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CommentaryError('request');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw new CommentaryError('request');
}
function check(valid: boolean) { if (!valid) throw new CommentaryError('request'); }
function count(value: unknown, min: number, max: number) {
  check(typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max);
}
function numeric(value: unknown) { check(value === null || (typeof value === 'number' && Number.isFinite(value))); }
function enumeration(value: unknown, values: readonly unknown[]) { check(values.includes(value)); }
function bool(value: unknown) { check(typeof value === 'boolean'); }

export function validateContext(value: unknown) {
  const context = record(value);
  keys(context, ['scope', 'scoringStatus', 'names', 'profileValues', 'facts'], ['tree', 'profile', 'profileTruncated', 'modelEvidence']);
  if (Object.hasOwn(context, 'modelEvidence')) validateModelEvidence(context.modelEvidence, () => { throw new CommentaryError('request'); });
  enumeration(context.scope, ['model', 'tree', 'node', 'trace']);
  check(context.scoringStatus === 'unverified-preview' && context.names === 'omitted');
  enumeration(context.profileValues, ['omitted', 'numeric-only; text redacted']);
  const facts = record(context.facts);
  if (context.scope === 'model') {
    keys(context, ['scope', 'scoringStatus', 'names', 'profileValues', 'facts'], ['modelEvidence']);
    keys(facts, ['trees', 'predictors', 'nodes', 'deepestPathLevels']);
    count(facts.trees, 1, 2000); count(facts.predictors, 0, 250000); count(facts.nodes, 1, 250000); count(facts.deepestPathLevels, 1, 65);
  } else {
    count(context.tree, 1, 2000);
    if (context.scope === 'tree') {
      keys(facts, ['nodes', 'leaves', 'serializedLeafMinimum', 'serializedLeafMaximum']);
      count(facts.nodes, 1, 250000); count(facts.leaves, 1, 250000);
      numeric(facts.serializedLeafMinimum); numeric(facts.serializedLeafMaximum);
    } else if (context.scope === 'node') {
      if (facts.selectionAvailable === false) {
        keys(facts, ['selectionAvailable', 'reason']);
        check(facts.reason === 'selection exceeds bounds or is unavailable');
      } else {
        keys(facts, ['kind', 'serializedScore', 'exportedSampleCount', 'operator']);
        enumeration(facts.kind, ['split', 'leaf']); numeric(facts.serializedScore); numeric(facts.exportedSampleCount);
        enumeration(facts.operator, ['less-than', 'membership', 'unsupported', 'none']);
      }
    } else {
      keys(facts, ['routeComplete', 'resolvedBranches', 'branchesTruncated', 'issue', 'leafContribution', 'runningRawScore', 'ensembleComplete', 'ensembleRawScore', 'unverifiedPropensityPreview']);
      bool(facts.routeComplete); bool(facts.branchesTruncated); bool(facts.ensembleComplete);
      check(Array.isArray(facts.resolvedBranches) && facts.resolvedBranches.length <= 32);
      if (Array.isArray(facts.resolvedBranches)) facts.resolvedBranches.forEach(branch => enumeration(branch, ['left', 'right']));
      enumeration(facts.issue, [null, 'missing-value', 'invalid-number', 'unsupported-split', 'unknown-category']);
      for (const key of ['leafContribution', 'runningRawScore', 'ensembleRawScore', 'unverifiedPropensityPreview']) numeric(facts[key]);
      check(facts.unverifiedPropensityPreview === null || (typeof facts.unverifiedPropensityPreview === 'number' && facts.unverifiedPropensityPreview >= 0 && facts.unverifiedPropensityPreview <= 1));
    }
  }
  if (context.profileValues !== 'omitted') {
    check(context.scope === 'trace' && Array.isArray(context.profile) && context.profile.length <= 16);
    bool(context.profileTruncated);
    if (Array.isArray(context.profile)) context.profile.forEach((value, index) => {
      const step = record(value); keys(step, ['slot', 'value', 'branch']);
      check(step.slot === index + 1);
      if (step.value !== '[redacted]') numeric(step.value);
      enumeration(step.branch, ['left', 'right']);
    });
  } else check(!Object.hasOwn(context, 'profile') && !Object.hasOwn(context, 'profileTruncated'));
  if (context.scope !== 'trace') check(context.profileValues === 'omitted');
  if (context.modelEvidence) {
    const evidence = record(context.modelEvidence);
    const coverage = record(evidence.coverage);
    if (context.scope === 'model') {
      check(facts.trees === coverage.trees && facts.nodes === coverage.nodes && facts.predictors === evidence.distinctPredictors);
      check(facts.deepestPathLevels === Number(record(evidence.structure).maximumDepthEdges) + 1);
    } else check(Number(context.tree) <= Number(coverage.trees));
  }
  return context;
}

export function buildAnthropicPayload(model: string, context: unknown) {
  enumeration(model, ANTHROPIC.models);
  const payload = {
    model, max_tokens: 500, stream: false, system: SYSTEM,
    messages: [{ role: 'user' as const, content: PREFIX + JSON.stringify(validateContext(context)) }],
  };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_REQUEST_BYTES) throw new CommentaryError('oversized');
  return payload;
}
export type AnthropicPayload = ReturnType<typeof buildAnthropicPayload>;
export function validateSubmission(value: unknown): AnthropicPayload {
  const submission = record(value);
  keys(submission, ['payload', 'approved', 'profileApproved']);
  if (submission.approved !== true || typeof submission.profileApproved !== 'boolean') throw new CommentaryError('consent');
  const payload = record(submission.payload);
  keys(payload, ['model', 'max_tokens', 'stream', 'system', 'messages']);
  check(typeof payload.model === 'string' && Array.isArray(payload.messages) && payload.messages.length === 1);
  const message = record((payload.messages as unknown[])[0]);
  keys(message, ['role', 'content']);
  check(message.role === 'user' && typeof message.content === 'string' && message.content.startsWith(PREFIX));
  let context: unknown;
  try { context = JSON.parse((message.content as string).slice(PREFIX.length)); } catch { throw new CommentaryError('request'); }
  const validated = validateContext(context);
  if ((validated.profileValues !== 'omitted') !== submission.profileApproved) throw new CommentaryError('consent');
  const expected = buildAnthropicPayload(payload.model as string, context);
  check(JSON.stringify(expected) === JSON.stringify(payload));
  return expected;
}

export async function readBoundedJSON(response: Response, byteLimit = MAX_RESPONSE_BYTES): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !response.body) {
    await response.body?.cancel();
    throw new CommentaryError('response');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > byteLimit) throw new CommentaryError('oversized');
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new CommentaryError('response'); }
  } finally {
    await reader.cancel().catch(() => { /* The connection may already be aborted. */ });
    reader.releaseLock();
  }
}
export function readCommentary(value: unknown, characterLimit = 8000, byteLimit = 32_000): string {
  const message = record(value);
  if (message.type !== 'message' || message.role !== 'assistant' || message.stop_reason !== 'end_turn' || !Array.isArray(message.content) || message.content.length < 1 || message.content.length > 8) throw new CommentaryError('response');
  const texts = message.content.map(value => {
    const block = record(value);
    if (block.type !== 'text' || typeof block.text !== 'string') throw new CommentaryError('response');
    return block.text;
  });
  const text = texts.join('\n').trim();
  if (!text || text.length > characterLimit || new TextEncoder().encode(text).byteLength > byteLimit) throw new CommentaryError('response');
  return text;
}
