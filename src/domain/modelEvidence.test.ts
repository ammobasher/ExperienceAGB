import { describe, expect, it } from 'vitest';
import { computeModelEvidence } from './modelEvidence';
import type { AGBModel } from './agb';
import { parseSplit } from './split';
import { validateModelEvidence } from '../ai/modelEvidenceValidation';

function model(): AGBModel {
  return { modelVersion: 'private-version', scoringStatus: 'unverified-preview', trainingStats: { positiveCount: 2, negativeCount: 8, totalCount: 10 }, successRate: 0.2, auc: 0.7, trees: [
    { score: 0, sampleCount: 10, gain: 1, split: 'Customer.Secret < 3', condition: parseSplit('Customer.Secret < 3'), left: { score: -1, gain: 0, sampleCount: 4 }, right: { score: 2, gain: 0, sampleCount: 6 } },
    { score: 1, sampleCount: 8, gain: 3, split: 'IH.Web.Clicked.Count < 2', condition: parseSplit('IH.Web.Clicked.Count < 2'), left: { score: 0, gain: 0, sampleCount: 3 }, right: { score: 3, gain: 0, sampleCount: 4 } },
  ] };
}
describe('full-model local evidence', () => {
  it('rejects stale evidence schemas and impossible v6.4 review-candidate counts', () => {
    const evidence = computeModelEvidence(model());
    for (const input of [
      { ...evidence, version: 'whole-model-v1' },
      { ...evidence, structure: { ...evidence.structure, numericLookingMembershipSplits: 1 } },
      { ...evidence, structure: { ...evidence.structure, missingChecks: 1 } },
    ]) expect(() => validateModelEvidence(input, () => { throw new Error('Invalid evidence'); })).toThrow();
  });
  it('keeps decimal gain shares in range despite different floating-point accumulation orders', () => {
    const input = model();
    input.trees = Array.from({ length: 13 }, () => ({
      ...input.trees[0], gain: 0.1,
      left: { ...input.trees[0], gain: 0.2, split: 'Customer.Second < 3', condition: parseSplit('Customer.Second < 3') },
    }));
    const evidence = computeModelEvidence(input);
    expect(evidence.namespaces.find(row => row.namespace === 'customer')?.gainShare).toBeLessThanOrEqual(1);
    expect(() => validateModelEvidence(evidence, () => { throw new Error('Invalid evidence'); })).not.toThrow();
  });
  it('covers every tree/node, including a nonselected tree, with exact computed manifest values', () => {
    const evidence = computeModelEvidence(model(), 123);
    expect(evidence.coverage).toEqual({ fileBytes: 123, trees: 2, nodes: 6, internalNodes: 2, leaves: 4, binaryLeafInvariant: true });
    expect(evidence.structure).toMatchObject({ maximumDepthEdges: 1, stumpTrees: 0, lessThanSplits: 2, membershipSplits: 0, unparsedSplits: 0, firstRootSampleCount: 10, lastRootSampleCount: 8, rootCountsStrictlyDecrease: true });
    expect(evidence.gain).toMatchObject({ totalInternalGain: 4, firstQuarterShare: 0.25, lastQuarterShare: 0.75, topPredictorGainShare: 0.75 });
    expect(evidence.monitoring).toMatchObject({ positiveCount: 2, negativeCount: 8, totalCount: 10, baseSuccessRate: 0.2, pooledAUC: 0.7, successRateMatchesTraining: true });
    expect(evidence.namespaces.find(row => row.namespace === 'interaction-history')).toMatchObject({ splitCount: 1, gainShare: 0.75 });
    expect(JSON.stringify(evidence)).not.toMatch(/Secret|Clicked|private-version|Customer\./);
    const changed = model(); changed.trees[1].gain = 9;
    expect(computeModelEvidence(changed).gain.totalInternalGain).toBe(10);
  });
  it('does not invent missing gains or training metadata and labels incomplete/invalid arithmetic', () => {
    const input = model();
    delete input.trainingStats; delete input.trees[1].gain;
    const missing = computeModelEvidence(input);
    expect(missing.gain.totalInternalGain).toBeNull();
    expect(missing.gain.missingInternalGains).toBe(1);
    expect(missing.monitoring.baseSuccessRate).toBeNull();
    expect(missing.predictors.every(row => row.gainShare === null)).toBe(true);
    input.trees[0].gain = -1; input.trees[1].gain = 2;
    expect(computeModelEvidence(input).gain.totalInternalGain).toBeNull();
    input.trees[0].gain = Number.MAX_VALUE; input.trees[1].gain = Number.MAX_VALUE;
    expect(computeModelEvidence(input).gain.totalInternalGain).toBeNull();
  });
  it('bounds disclosure while retaining full-ensemble totals and isolated zero/stump semantics', () => {
    const input = model();
    input.trees = Array.from({ length: 100 }, (_, index) => ({ ...input.trees[0], split: `private${index} < 3`, condition: parseSplit(`private${index} < 3`) }));
    const evidence = computeModelEvidence(input);
    expect(evidence.coverage.trees).toBe(100);
    expect(evidence.distinctPredictors).toBe(100);
    expect(evidence.predictors).toHaveLength(8);
    expect(evidence.predictorsTruncated).toBe(true);
    expect(evidence.namespaces.reduce((sum, row) => sum + row.splitCount, 0)).toBe(100);
    const stump = computeModelEvidence({ ...input, trees: [{ score: 0, sampleCount: 0 }] });
    expect(stump.structure.stumpTrees).toBe(1);
    expect(stump.gain.topPredictorGainShare).toBeNull();
    expect(stump.gain.scoreDecayRatio).toBeNull();
  });
});
