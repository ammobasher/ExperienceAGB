import { describe, expect, it } from 'vitest';
import { agbPropensityFromRawScore, buildProfileFeatures, createIllustrativeProfile, traceEnsemblePreview, traceTreePreview } from './profileTrace';
import type { TreeNode } from './agb';
import { validateAGBExport } from './importModel';

const tree: TreeNode = {
  score: 0,
  sampleCount: 30,
  split: 'Customer.Age < 35',
  left: { score: -0.2, sampleCount: 12 },
  right: {
    score: 0.1,
    sampleCount: 18,
    split: 'Param.Channel in [Web, Store]',
    left: { score: 0.2, sampleCount: 8 },
    right: { score: -0.1, sampleCount: 10 },
  },
};

describe('illustrative profile trace preview', () => {
  it('generates an explicitly illustrative profile and finds a leaf for each tree', () => {
    const features = buildProfileFeatures([tree]);
    const profile = createIllustrativeProfile(features);
    const trace = traceTreePreview(tree, 0, profile);
    expect(profile).toEqual({ 'Customer.Age': '35', 'Param.Channel': 'Store' });
    expect(trace).toMatchObject({ complete: true, path: ['root', 'root.R', 'root.R.L'], leaf: { score: 0.2 } });
  });

  it('does not choose a branch when a required value is missing or invalid', () => {
    expect(traceTreePreview(tree, 0, {}).issue?.reason).toBe('missing-value');
    expect(traceTreePreview(tree, 0, { 'Customer.Age': 'young' }).issue?.reason).toBe('invalid-number');
  });

  it('routes a value equal to a numeric threshold to the false/right branch', () => {
    const trace = traceTreePreview(tree, 0, { 'Customer.Age': '35', 'Param.Channel': 'Store' });

    expect(trace.path).toEqual(['root', 'root.R', 'root.R.L']);
    expect(trace.leaf?.score).toBe(0.2);
  });

  it('withholds unknown categories and decimal-invalid supplied inputs', () => {
    expect(traceTreePreview(tree, 0, { 'Customer.Age': '35', 'Param.Channel': 'Unseen' }).issue?.reason).toBe('unknown-category');
    expect(traceTreePreview(tree, 0, { 'Customer.Age': '0x20', 'Param.Channel': 'Store' }).issue?.reason).toBe('invalid-number');
  });

  it('routes known categories outside a particular split right, with readable branch evidence', () => {
    const categoryTree: TreeNode = {
      score: 0, sampleCount: 2, split: 'Param.Channel in [Other]',
      left: { score: 0.1, sampleCount: 1 }, right: { score: 0.2, sampleCount: 1 },
    };
    const result = traceEnsemblePreview([tree, categoryTree], { 'Customer.Age': '35', 'Param.Channel': 'Other' });
    expect(result.complete).toBe(true);
    expect(result.stages[0].path).toEqual(['root', 'root.R', 'root.R.R']);
    expect(result.stages[0]).toHaveProperty('steps.0.branch', 'False / Right');
  });

  it('routes blank values through an explicit missing split', () => {
    const missingTree: TreeNode = {
      score: 0,
      sampleCount: 10,
      split: 'Customer.Age is Missing',
      left: { score: -0.2, sampleCount: 3 },
      right: { score: 0.2, sampleCount: 7 },
    };

    expect(traceTreePreview(missingTree, 0, { 'Customer.Age': '' })).toMatchObject({
      complete: true,
      path: ['root', 'root.L'],
      leaf: { score: -0.2 },
    });
    expect(traceTreePreview(missingTree, 0, { 'Customer.Age': '35' }).leaf?.score).toBe(0.2);
  });

  it('marks unknown split syntax as unsupported instead of routing it', () => {
    const unsupported = { ...tree, split: 'Customer.Age > 35' };
    expect(traceTreePreview(unsupported, 0, { 'Customer.Age': '40' }).issue?.reason).toBe('unsupported-split');
  });

  it('routes the same profile from each tree root and accumulates signed leaf scores', () => {
    const secondTree: TreeNode = {
      score: 0,
      sampleCount: 10,
      split: 'Customer.Age < 35',
      left: { score: 0.05, sampleCount: 4 },
      right: { score: -0.08, sampleCount: 6 },
    };
    const trace = traceEnsemblePreview([tree, secondTree], {
      'Customer.Age': '35',
      'Param.Channel': 'Store',
    });

    expect(trace.stages.map((stage) => stage.path[0])).toEqual(['root', 'root']);
    expect(trace.stages.map((stage) => stage.leaf?.score)).toEqual([0.2, -0.08]);
    expect(trace.runningScores[0]).toBeCloseTo(0.2);
    expect(trace.runningScores[1]).toBeCloseTo(0.12);
    expect(trace.complete).toBe(true);
    expect(trace.rawScore).toBeCloseTo(0.12);
    expect(trace.propensity).toBeCloseTo(1 / (1 + Math.exp(-0.12)));
  });

  it('withholds running totals after an unresolved tree route', () => {
    const laterTree: TreeNode = {
      score: 0,
      sampleCount: 10,
      left: { score: 0.3, sampleCount: 5 },
      split: 'Customer.Age < 35',
      right: { score: 0.3, sampleCount: 5 },
    };
    const trace = traceEnsemblePreview([tree, laterTree], { 'Customer.Age': '', 'Param.Channel': 'Store' });

    expect(trace.runningScores).toEqual([undefined, undefined]);
    expect(trace.complete).toBe(false);
    expect(trace.rawScore).toBeUndefined();
    expect(trace.propensity).toBeUndefined();
  });

  it('calculates stable sigmoid values across positive and negative raw scores', () => {
    expect(agbPropensityFromRawScore(0)).toBe(0.5);
    expect(agbPropensityFromRawScore(1000)).toBe(1);
    expect(agbPropensityFromRawScore(-1000)).toBe(0);
  });

  it.each([' Web ', 'a"b', '   '])('preserves imported quoted category identity: %j', (category) => {
    const result = validateAGBExport({
      type: 'AdaptiveBoostScoringModel', algorithm: 'GRADIENT_BOOST', modelVersion: '2',
      model: { booster: { trees: [{
        score: 0, sampleCount: 2, split: `Channel in [${JSON.stringify(category)}]`,
        left: { score: -1, sampleCount: 1 }, right: { score: 1, sampleCount: 1 },
      }] } },
    }, 400);
    expect(result.model).not.toBeNull();
    const trees = result.model!.trees;
    const profile = createIllustrativeProfile(buildProfileFeatures(trees));
    expect(traceEnsemblePreview(trees, profile).stages[0].path).toEqual(['root', 'root.L']);
  });

  it('withholds a preview on overflowing finite leaf arithmetic', () => {
    const result = traceEnsemblePreview([1e308, 1e308, -1e308, -1e308].map(score => ({ score, sampleCount: 1 })), {});
    expect(result.complete).toBe(false);
    expect(result.rawScore).toBeUndefined();
    expect(result.propensity).toBeUndefined();
    expect(result).toHaveProperty('arithmeticIssue');
  });

  it('does not treat an exact supplied whitespace category as missing in another tree', () => {
    const trees: TreeNode[] = ['Channel in ["   "]', 'Channel is Missing'].map(split => ({
      score: 0, sampleCount: 2, split, left: { score: -1, sampleCount: 1 }, right: { score: 1, sampleCount: 1 },
    }));
    const profile = createIllustrativeProfile(buildProfileFeatures(trees));
    expect(traceEnsemblePreview(trees, profile).stages.map(stage => stage.path)).toEqual([['root', 'root.L'], ['root', 'root.R']]);
  });

  it('preserves resolved branch evidence before a deeper route blocker', () => {
    const tree: TreeNode = {
      score: 0, sampleCount: 2, split: 'Age < 10', left: { score: 0, sampleCount: 1 },
      right: { score: 0, sampleCount: 1, split: 'Income < 20', left: { score: 0, sampleCount: 1 }, right: { score: 0, sampleCount: 1 } },
    };
    const result = traceTreePreview(tree, 0, { Age: '15', Income: '' });
    expect(result.complete).toBe(false);
    expect(result.path).toEqual(['root', 'root.R']);
    expect(result.steps).toEqual([expect.objectContaining({ question: 'Is Age less than 10?', branch: 'False / Right' })]);
  });

  it('treats inherited object keys as missing, not supplied profile values', () => {
    const adversarial: TreeNode = { score: 0, sampleCount: 2, split: 'toString < 1', left: { score: -1, sampleCount: 1 }, right: { score: 1, sampleCount: 1 } };
    expect(traceTreePreview(adversarial, 0, {}).issue?.reason).toBe('missing-value');
  });
});