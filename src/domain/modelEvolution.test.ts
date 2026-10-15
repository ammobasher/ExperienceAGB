import { describe, expect, it } from 'vitest';
import { analyseModel } from './modelAnalysis';
import { validateAGBExport } from './importModel';
import { compareSnapshots, formatEvolutionValue, metricSegments, orderSnapshots, parseManualSnapshotTime, summarizeEvolution } from './modelEvolution';
import type { EvolutionSnapshot } from './modelEvolution';

function example() {
  const leaf = { score: 0.1, sampleCount: 1 };
  const result = validateAGBExport({
    type: 'AdaptiveBoostScoringModel', algorithm: 'GRADIENT_BOOST', modelVersion: '2',
    factoryUpdateTime: '20240101T120000.000Z', successRate: 0, auc: .75,
    trainingStats: { positiveCount: 0, negativeCount: 20, totalCount: 20 },
    model: { booster: { trees: [{ score: 0, sampleCount: 2, split: 'Age < 35', left: leaf, right: leaf }, leaf] } },
  }, 1000);
  return { result, analysis: analyseModel(result.model!).summary };
}
function snapshot(id: string, time?: string): EvolutionSnapshot {
  const { result, analysis } = example();
  return { ...summarizeEvolution(result, analysis), id, name: `${id}.json`, time, timeSource: time ? 'export' : 'missing' };
}

describe('local model evolution', () => {
  it('summarizes the entire ensemble without retaining trees, sample rows or occurrence paths', () => {
    const { result, analysis } = example();
    const summary = summarizeEvolution(result, analysis);
    expect(summary).toMatchObject({
      exportTag: '2', exportedAt: '2024-01-01T12:00:00.000Z',
      metrics: { trees: 2, nodes: 4, leaves: 3, depth: 2, predictors: 1, auc: .75, successRate: 0, positiveCount: 0, negativeCount: 20, totalCount: 20, totalGain: null, topGainShare: null, stumps: 1, missingChecks: 0 },
      predictors: ['Age'],
    });
    expect(summary).not.toHaveProperty('trees');
    expect(summary.audit?.predictors[0]).not.toHaveProperty('firstOccurrence');
    expect(summary.audit?.predictors[0]).not.toHaveProperty('categories');
    expect(() => summarizeEvolution({ ...result, model: null }, analysis)).toThrow(/validated model/);
  });
  it('preserves absent metrics as unavailable and valid zero metrics as zero', () => {
    const { result, analysis } = example();
    delete result.model!.auc; delete result.model!.trainingStats;
    const summary = summarizeEvolution(result, analysis);
    expect(summary.metrics.auc).toBeNull();
    expect(summary.metrics.totalCount).toBeNull();
    expect(summary.metrics.successRate).toBe(0);
    expect(formatEvolutionValue('auc', null)).toBe('Not available');
    expect(formatEvolutionValue('successRate', 0)).toBe('0.00%');
    expect(formatEvolutionValue('auc', .812345)).toBe('0.8123');
  });
  it.each([
    ['2024-02-29T23:59', '2024-02-29T23:59:00.000Z'],
    ['2024-02-29T23:59:12', '2024-02-29T23:59:12.000Z'],
    ['2024-02-29T23:59:12.7', '2024-02-29T23:59:12.700Z'],
    ['2024-02-29T23:59:12.789', '2024-02-29T23:59:12.789Z'],
  ])('interprets a manual time as UTC without local-time conversion: %s', (input, expected) => {
    expect(parseManualSnapshotTime(input)).toBe(expected);
  });
  it.each(['2025-02-29T12:00', '2024-02-30T12:00', '2024-13-01T12:00', '2024-01-01T24:00', '', '2024-01-01', '2024-01-01T12:00Z', '2024-01-01T12:00:00+02:00', '2024-01-01T12:00:00.1234'])('rejects invalid, rolling or ambiguous dates: %s', input => {
    expect(parseManualSnapshotTime(input)).toBeUndefined();
  });
  it('sorts valid UTC dates independently of selection order; exposes missing and duplicate times', () => {
    const late = snapshot('a', '2025-01-01T00:00:00.000Z'), early = snapshot('z', '2024-01-01T00:00:00.000Z');
    const undated = snapshot('missing'), bad = snapshot('invalid', 'not-a-time');
    const ordered = orderSnapshots([late, undated, early, bad]);
    expect(ordered.dated.map(item => item.id)).toEqual(['z', 'a']);
    expect(ordered.undated.map(item => item.id)).toEqual(['missing', 'invalid']);
    expect(ordered.duplicateTimes).toEqual([]);
    expect(orderSnapshots([late, { ...late, id: 'duplicate' }]).duplicateTimes).toEqual([late.time]);
  });
  it('breaks trend segments at missing values rather than joining or zero-filling them', () => {
    const first = snapshot('1', '2024-01-01T00:00:00.000Z'), second = snapshot('2', '2024-02-01T00:00:00.000Z'), third = snapshot('3', '2024-04-01T00:00:00.000Z');
    first.metrics.successRate = 0; second.metrics.successRate = null; third.metrics.successRate = .1;
    expect(metricSegments([first, second, third], 'successRate').map(segment => segment.map(point => point.value))).toEqual([[0], [.1]]);
  });
  it('reports exact case-sensitive predictor changes and unavailable endpoint deltas', () => {
    const before = snapshot('1'), after = snapshot('2');
    before.predictors = ['Age', 'Channel']; after.predictors = ['age', 'Age', 'Country'];
    after.metrics.nodes = 100; after.metrics.auc = null;
    const comparison = compareSnapshots(before, after);
    expect(comparison.added).toEqual(['Country', 'age']);
    expect(comparison.removed).toEqual(['Channel']);
    expect(comparison.changes.find(item => item.metric === 'nodes')?.delta).toBe(96);
    expect(comparison.changes.find(item => item.metric === 'auc')?.delta).toBeNull();
  });
});
