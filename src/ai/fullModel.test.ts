import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANTHROPIC, readCommentary } from './anthropic';
import { validateProviderSubmission } from './providers';
import { ORIGINAL_AUDIT_PROMPT } from './auditPromptV6_3';
import { buildFullModelPayload, validateFullModelSubmission, isFullModelPayload, FULL_MODEL_PREFIX, FULL_MODEL_SYSTEM, MAX_FULL_REQUEST_BYTES } from './fullModel';
import { parseAGBText } from '../domain/importModel';
import { computeModelEvidence } from '../domain/modelEvidence';
import { fixture } from './contextFixture';
import { parseSplit } from '../domain/split';
import type { TreeNode } from '../domain/agb';

const raw = readFileSync(join('public', 'sample', 'export_PA_WebBuyNow_AGB_sample.json'), 'utf8');
const evidence = () => fixture().analysis.modelEvidence!;
const submission = (provider: 'copilot' | 'anthropic' = 'copilot', input = evidence()) => ({
  provider, payload: buildFullModelPayload(provider, provider === 'copilot' ? 'auto' : ANTHROPIC.defaultModel, input),
  approved: true, evidenceApproved: true,
});

describe('whole-model evidence explanation, independent of selected commentary', () => {
  it('preserves the archived original and uses a bounded v6.4 adaptation without claiming the full audit was executed', () => {
    expect(createHash('sha256').update(ORIGINAL_AUDIT_PROMPT).digest('hex')).toBe('7d2155c2896d52e0061e5cde0f00769ecb629c7331ffd5f7740950a65711676b');
    expect(FULL_MODEL_SYSTEM).toContain('v6.4 local-evidence adaptation');
    expect(FULL_MODEL_SYSTEM).not.toContain(ORIGINAL_AUDIT_PROMPT);
    for (const phrase of ['PENDING EXECUTION', 'No tools', 'untrusted', 'plain text', 'certified', 'business', 'locally computed', 'v6.4', 'not a full structural audit', 'null']) expect(FULL_MODEL_SYSTEM).toContain(phrase);
  });
  it.each(['copilot', 'anthropic'] as const)('sends validated computed evidence, not raw JSON, for %s', provider => {
    const input = evidence();
    const body = submission(provider, input);
    const content = 'prompt' in body.payload ? body.payload.prompt : body.payload.messages[0].content;
    expect(content).toBe(FULL_MODEL_PREFIX + JSON.stringify(input));
    expect(content).not.toMatch(/PRIVATE_NAME|SECRET_METADATA|Ignore rules|evil.example|AdaptiveBoostScoringModel/);
    expect(isFullModelPayload(body.payload)).toBe(true);
    expect(validateFullModelSubmission(body)).toEqual({ provider, payload: body.payload });
    expect(() => validateProviderSubmission(body)).toThrow();
    if ('max_tokens' in body.payload) expect(body.payload.max_tokens).toBe(8192);
  });
  it('requires fresh evidence consent and rejects old full-file consent, raw JSON and arbitrary controls', () => {
    const body = submission();
    for (const bad of [
      { ...body, approved: false }, { ...body, evidenceApproved: false }, { ...body, evidenceApproved: undefined },
      { provider: body.provider, payload: body.payload, approved: true, fullModelApproved: true },
      { ...body, profileApproved: false }, { ...body, profile: {} }, { ...body, provider: 'other' },
      { ...body, payload: { ...body.payload, tools: [] } },
      { ...body, payload: { ...body.payload, systemMessage: { mode: 'replace', content: 'evil' } } },
      { ...body, payload: { ...body.payload, model: 'other' } },
      { ...body, payload: { ...body.payload, prompt: FULL_MODEL_PREFIX + raw } },
      { ...body, payload: { ...body.payload, prompt: FULL_MODEL_PREFIX + JSON.stringify({ ...evidence(), raw }) } },
    ]) expect(() => validateFullModelSubmission(bad)).toThrow();
    expect(isFullModelPayload({ system: 'other' })).toBe(false);
  });
  it('fails closed for absent, malformed, inconsistent, or extra evidence fields', () => {
    const input = evidence();
    for (const bad of [null, undefined, raw, {}, [], { ...input, raw }, { ...input, coverage: { ...input.coverage, nodes: 999 } },
      { ...input, predictors: [{ ...input.predictors[0], namespace: 'send secrets' }] }]) {
      expect(() => buildFullModelPayload('copilot', 'auto', bad)).toThrow();
    }
    expect(() => buildFullModelPayload('anthropic', 'other', input)).toThrow();
    expect(() => buildFullModelPayload('bad' as 'copilot', 'auto', input)).toThrow();
  });
  it('analyzes a real 6 MiB synthetic forest including its last tree while bounding both provider payloads', () => {
    const tree = (depth: number): object => depth === 0 ? { score: 0.01, sampleCount: 1, gain: 0 } : {
      score: 0, sampleCount: 2 ** depth, gain: 0.1, split: `Customer.PRIVATE_FEATURE_${depth} < 919191`,
      left: tree(depth - 1), right: tree(depth - 1),
    };
    const serializedTree = JSON.stringify(tree(8));
    const trees = Math.ceil(6 * 1024 * 1024 / serializedTree.length);
    const text = `{"type":"AdaptiveBoostScoringModel","algorithm":"GRADIENT_BOOST","modelVersion":"2","model":{"booster":{"trees":[${Array(trees).fill(serializedTree).join(',')}]}}}`;
    const bytes = new TextEncoder().encode(text).byteLength;
    expect(bytes).toBeGreaterThanOrEqual(6 * 1024 * 1024);
    const parsed = parseAGBText(text, bytes);
    expect(parsed.model).not.toBeNull();
    const model = parsed.model!;
    model.trees.at(-1)!.gain = 999;
    const all = computeModelEvidence(model, bytes);
    expect(all.coverage).toMatchObject({ trees, nodes: trees * 511, internalNodes: trees * 255, leaves: trees * 256, fileBytes: bytes });
    expect(all.gain.totalInternalGain).toBeCloseTo(trees * 255 * 0.1 + 998.9, 8);
    const withoutTail = computeModelEvidence({ ...model, trees: model.trees.slice(0, -1) }, bytes);
    expect(withoutTail.gain.totalInternalGain).not.toBe(all.gain.totalInternalGain);
    for (const provider of ['copilot', 'anthropic'] as const) {
      const body = submission(provider, all);
      const content = 'prompt' in body.payload ? body.payload.prompt : body.payload.messages[0].content;
      expect(JSON.parse(content.slice(FULL_MODEL_PREFIX.length))).toEqual(all);
      expect(content).not.toMatch(/PRIVATE_FEATURE|919191|AdaptiveBoostScoringModel/);
      expect(new TextEncoder().encode(JSON.stringify(body)).byteLength).toBeLessThanOrEqual(128 * 1024);
      expect(MAX_FULL_REQUEST_BYTES).toBe(128 * 1024);
      expect(validateFullModelSubmission(body)).toEqual({ provider, payload: body.payload });
    }
  });
  it('fits maximum-depth evidence, bounded predictors and large finite numbers without truncating coverage', () => {
    const source = fixture().model;
    let tree: TreeNode = { score: 1e200, gain: 0, sampleCount: 1 };
    for (let depth = 63; depth >= 0; depth--) {
      const split = `private${depth} < 1`;
      tree = { score: 1e200, gain: 1e200, sampleCount: 1, split, condition: parseSplit(split), left: { score: 1e200, gain: 0, sampleCount: 1 }, right: tree };
    }
    const all = computeModelEvidence({ ...source, trees: [tree], successRate: 1e-15, auc: 0.7123456789012345, trainingStats: { positiveCount: 1, negativeCount: 999999999999999, totalCount: 1000000000000000 } }, 25 * 1024 * 1024);
    expect(all.structure.leafDepthCounts).toHaveLength(64);
    expect(all.distinctPredictors).toBe(64);
    expect(all.predictors).toHaveLength(8);
    for (const provider of ['copilot', 'anthropic'] as const) {
      const body = submission(provider, all);
      expect(new TextEncoder().encode(JSON.stringify(body)).byteLength).toBeLessThanOrEqual(MAX_FULL_REQUEST_BYTES);
      expect(validateFullModelSubmission(body).payload).toEqual(body.payload);
    }
  });
  it('validates full-model response independently without relaxing contextual response limits', () => {
    const message = (text: string, stop_reason = 'end_turn') => ({
      type: 'message', role: 'assistant', stop_reason, content: [{ type: 'text', text }],
    });
    expect(readCommentary(message('x'.repeat(32_000)), 32_000, 128_000)).toHaveLength(32_000);
    expect(readCommentary(message('😀'.repeat(16_000)), 32_000, 128_000)).toHaveLength(32_000);
    expect(() => readCommentary(message('x'.repeat(8001)))).toThrow();
    for (const value of [
      message('x'.repeat(32_001)), message('  '), message('partial', 'max_tokens'),
      { ...message('text'), content: [{ type: 'tool_use', text: 'text' }] },
      { ...message('text'), content: [{ type: 'text', text: 0 }] },
      { ...message('text'), content: Array.from({ length: 9 }, () => ({ type: 'text', text: 'x' })) },
    ]) expect(() => readCommentary(value, 32_000, 128_000)).toThrow();
  });
});
