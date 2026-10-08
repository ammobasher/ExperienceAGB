import { describe, expect, it } from 'vitest';
import { IMPORT_LIMITS, parseAGBText, validateAGBExport } from './importModel';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const validModel = {
  type: 'AdaptiveBoostScoringModel',
  modelVersion: '2',
  algorithm: 'GRADIENT_BOOST',
  model: { booster: { trees: [{ score: 0.1, sampleCount: 20, split: 'Customer.Age < 35', left: { score: -0.1, sampleCount: 8 }, right: { score: 0.2, sampleCount: 12 } }] } },
};

describe('AGB import boundary', () => {
  it('returns a canonical model only for a supported structure', () => {
    const result = validateAGBExport(validModel, 400);
    expect(result.model?.trees).toHaveLength(1);
    expect(result.nodeCount).toBe(3);
    expect(result.issues).toEqual([]);
  });

  it('rejects malformed JSON with a useful path', () => {
    expect(parseAGBText('{', 1).issues[0]).toMatchObject({ path: '$', severity: 'error' });
  });

  it('rejects unsupported split syntax instead of guessing a route', () => {
    const model = structuredClone(validModel);
    model.model.booster.trees[0].split = 'Customer.Age > 35';
    expect(validateAGBExport(model, 400).issues).toContainEqual(expect.objectContaining({ path: '$.model.booster.trees[0].split' }));
  });

  it('rejects incomplete branches and oversized files', () => {
    const model = structuredClone(validModel);
    delete (model.model.booster.trees[0] as { right?: unknown }).right;
    expect(validateAGBExport(model, 400).issues).toContainEqual(expect.objectContaining({ message: 'A split node must have both left and right children.' }));
    expect(validateAGBExport(validModel, IMPORT_LIMITS.maxFileSizeBytes + 1).model).toBeNull();
  });

  it.each([null, false, 0, 42, {}, [], '', ' '])('rejects invalid present split fields: %j', (split) => {
    const model = { ...validModel, model: { booster: { trees: [{ score: 0.75, sampleCount: 2, split }] } } };
    expect(validateAGBExport(model, 400).model).toBeNull();
  });

  it('restricts preview imports to the observed version and rejects unknown scoring metadata', () => {
    expect(validateAGBExport({ ...validModel, modelVersion: '999' }, 400).model).toBeNull();
    expect(validateAGBExport({
      ...validModel,
      model: { booster: { ...validModel.model.booster, calibration: { offset: 100 } } },
    }, 400).model).toBeNull();
    expect(validateAGBExport({ ...validModel, treeWeights: [2] }, 400).model).toBeNull();
  });

  it('accepts the observed UUID-v4-tagged structure without replacing its export tag or score authority', () => {
    const modelVersion = '11111111-2222-4333-8444-555555555555';
    const result = validateAGBExport({ ...validModel, modelVersion }, 400);
    expect(result.issues).toEqual([]);
    expect(result.model).toMatchObject({ modelVersion, scoringStatus: 'unverified-preview' });
    expect(result.model?.trees[0].condition?.operator).toBe('lt');
    expect(validateAGBExport({ ...validModel, modelVersion, treeWeights: [2] }, 400).model).toBeNull();
  });

  it.each(['3', 'future', '11111111-2222-1333-8444-555555555555', '11111111-2222-4333-7444-555555555555', 2, null])('rejects unobserved/malformed export tags: %j', modelVersion => {
    expect(validateAGBExport({ ...validModel, modelVersion }, 400).model).toBeNull();
  });

  it('builds a detached canonical representation with parsed splits and unverified provenance', () => {
    const model = structuredClone(validModel);
    const result = validateAGBExport(model, 400);
    expect(result.model?.trees[0]).not.toBe(model.model.booster.trees[0]);
    expect(result.model).toMatchObject({ scoringStatus: 'unverified-preview' });
    expect(result.model?.trees[0]).toHaveProperty('condition.operator', 'lt');
    model.model.booster.trees[0].right.score = 999;
    expect(result.model?.trees[0].right?.score).toBe(0.2);
  });

  it('rejects a supplied file size before parsing JSON', () => {
    expect(parseAGBText('{', IMPORT_LIMITS.maxFileSizeBytes + 1).issues[0]?.path).toBe('$file');
  });

  it('rejects nonfinite scores, unsafe counts, excessive depth and tree count', () => {
    for (const invalid of [{ score: Infinity, sampleCount: 1 }, { score: 0, sampleCount: Number.MAX_SAFE_INTEGER + 1 }]) {
      expect(validateAGBExport({ ...validModel, model: { booster: { trees: [invalid] } } }, 400).model).toBeNull();
    }
    let node: Record<string, unknown> = { score: 0, sampleCount: 1 };
    for (let depth = 0; depth < 66; depth += 1) {
      node = { score: 0, sampleCount: 1, split: 'Age < 1', left: node, right: { score: 0, sampleCount: 1 } };
    }
    expect(validateAGBExport({ ...validModel, model: { booster: { trees: [node] } } }, 400).model).toBeNull();
    expect(validateAGBExport({ ...validModel, model: { booster: { trees: Array(2001).fill({ score: 0, sampleCount: 0 }) } } }, 400).model).toBeNull();
  });

  it('rejects unbounded categorical lists before workspace analysis', () => {
    const model = structuredClone(validModel);
    model.model.booster.trees[0].split = `Channel in [${Array(130000).fill('x').join(',')}]`;
    const result = validateAGBExport(model, 260400);
    expect(result.model).toBeNull();
    expect(result.issues[0].message).toMatch(/categor|limit/i);
  });

  it('loads the actual bundled sample rather than only handcrafted mock exports', () => {
    const text = readFileSync(resolve('public', 'sample', 'export_PA_WebBuyNow_AGB_sample.json'), 'utf8');
    const result = parseAGBText(text, Buffer.byteLength(text));
    expect(result.issues).toEqual([]);
    expect(result.model?.trees).toHaveLength(12);
    expect(result.nodeCount).toBe(120);
  });

  it('validates observed isLeaf markers instead of trusting contradictory structure', () => {
    expect(validateAGBExport({ ...validModel, model: { booster: { trees: [{ score: 1, sampleCount: 1, isLeaf: false }] } } }, 400).model).toBeNull();
    const tree = { ...validModel.model.booster.trees[0], isLeaf: true };
    expect(validateAGBExport({ ...validModel, model: { booster: { trees: [tree] } } }, 400).model).toBeNull();
  });

  it('normalizes observed UTC timestamps and diagnoses invalid metadata without fabricating a date', () => {
    const valid = validateAGBExport({ ...validModel, factoryUpdateTime: '20240101T120000.000Z' }, 400);
    expect(valid.model?.factoryUpdateTime).toBe('2024-01-01T12:00:00.000Z');
    const invalid = validateAGBExport({ ...validModel, factoryUpdateTime: '20240231T120000.000Z' }, 400);
    expect(invalid.model?.factoryUpdateTime).toBeUndefined();
    expect(invalid.issues).toContainEqual(expect.objectContaining({ severity: 'warning', path: '$.factoryUpdateTime' }));
    expect(validateAGBExport({ ...validModel, trainingStats: { positiveCount: 9, negativeCount: 9, totalCount: 1 } }, 400).model).toBeNull();
  });
});