import { describe, expect, it } from 'vitest';
import { validateAGBExport } from './importModel';
import { analyseModel } from './modelAnalysis';

describe('prepared model analysis', () => {
  it('computes tree metrics and bounds initial occurrence payloads without losing counts', () => {
    const trees = Array.from({ length: 100 }, () => ({
      score: 0, sampleCount: 2, split: 'Age < 35',
      left: { score: -0.1, sampleCount: 1 }, right: { score: 0.2, sampleCount: 1 },
    }));
    const result = validateAGBExport({ type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST', model: { booster: { trees } } }, 20000);
    const analysis = analyseModel(result.model!);
    expect(analysis.summary.treeFacts[0]).toMatchObject({ nodeCount: 3, leaves: 2, minimum: -0.1, maximum: 0.2 });
    expect(analysis.summary.predictors[0].count).toBe(100);
    expect(analysis.summary.predictors[0].initialOccurrences.length).toBeLessThanOrEqual(20);
    expect(analysis.occurrences.get('Age')).toHaveLength(100);
    expect(analysis.summary.features[0].name).toBe('Age');
  });
});
