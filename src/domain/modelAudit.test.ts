import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AGBModel } from './agb';
import { analyseModel } from './modelAnalysis';
import { parseAGBText, validateAGBExport } from './importModel';
import { parseSplit } from './split';
import { auditMetrics } from './auditMetrics';
import { formatAuditAxisNumber, formatAuditNumber, formatAuditPercent, hashAuditCategories, interpolateRange, rangeFraction } from './modelAudit';
import { buildAuditExport } from './auditExport';
import { compareSnapshots, summarizeEvolution } from './modelEvolution';

function example(): AGBModel {
  const leaf = (score: number) => ({ score, sampleCount: 0 });
  return { modelVersion: '2', scoringStatus: 'unverified-preview', trees: [
    { score: 0, sampleCount: 0, gain: .00001, split: 'Param.Score is Missing', condition: parseSplit('Param.Score is Missing'), left: leaf(-.1), right: leaf(.2) },
    { score: 0, sampleCount: 0, gain: .00002, split: 'IH.Web.Clicked.Recency < 2', condition: parseSplit('IH.Web.Clicked.Recency < 2'), left: leaf(-.2), right: leaf(.1) },
    { score: 0, sampleCount: 0, gain: .00003, split: 'Customer.Product in { "A,B", 12 }', condition: parseSplit('Customer.Product in { "A,B", 12 }'), left: leaf(0), right: leaf(.3) },
  ] };
}
afterEach(() => vi.unstubAllGlobals());
describe('v6.4 local structural audit', () => {
  it('formats readable percentages without hiding tiny shares or rounding integer counts', () => {
    expect(formatAuditPercent(.0842)).toBe(`${(8.42).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`);
    expect(formatAuditPercent(1 / 3)).toBe(`${(100 / 3).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`);
    expect(formatAuditPercent(null)).toBe('Not available');
    expect(formatAuditPercent(0)).toBe('0%');
    expect(formatAuditPercent(1e-9)).not.toBe('0%');
    expect(formatAuditPercent(-1e-9)).not.toBe('0%');
    expect(formatAuditNumber(1000000001)).toBe((1000000001).toLocaleString());
    expect(formatAuditAxisNumber(1000000).length).toBeLessThan(formatAuditNumber(1000000).length);
  });
  it('rejects duplicate escaped and nested JSON keys without confusing strings or separate objects', () => {
    for (const text of ['{"auc":0.1,"auc":0.9}', '{"nested":{"score":0,"scor\\u0065":1}}', '{"__proto__":1,"__proto__":2}']) {
      expect(parseAGBText(text, text.length).issues[0].message).toMatch(/Duplicate object keys/);
    }
    const value = { type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST', model: { booster: { trees: [{ score: 0, sampleCount: 1 }, { score: 1, sampleCount: 1 }] } } };
    const text = JSON.stringify(value);
    expect(parseAGBText(text, text.length).model).not.toBeNull();
    expect(parseAGBText('{bad', 4).issues[0].message).toMatch(/not valid JSON/);
  });
  it('counts missing checks separately, preserves literal namespaces and treats score-like roles as unverified', () => {
    const { summary } = analyseModel(example());
    expect(summary.modelEvidence?.structure).toMatchObject({ lessThanSplits: 1, membershipSplits: 1, missingChecks: 1, unparsedSplits: 0, numericLookingMembershipSplits: 1, singletonMembershipSplits: 0 });
    expect(summary.audit?.predictors[0]).toMatchObject({ feature: 'Param.Score', namespace: 'Param', role: 'Score-like name (provenance unverified)' });
    expect(summary.modelEvidence?.predictors.find(row => row.slot === 1)?.namespace).toBe('serving-context');
    expect(summary.audit?.predictors[2].observedCategories).toBe(2);
    expect(summary.audit?.predictors[2].firstOccurrence).toEqual({ treeIndex: 2, nodeId: 'root' });
  });
  it('continues independent metrics without optional AUC or leaf gains and preserves tiny positive gains', () => {
    const { summary } = analyseModel(example());
    expect(summary.modelEvidence?.monitoring.pooledAUC).toBeNull();
    expect(summary.modelEvidence?.gain.missingLeafGains).toBe(6);
    expect(summary.audit?.trees[0].gain).toBe(.00001);
    expect(summary.audit?.predictors.every(row => row.gainShare !== null)).toBe(true);
    const metrics = auditMetrics(summary.modelEvidence!);
    expect(metrics.find(row => row.id === 'gain.totalInternalGain')?.validity).toBe('available');
    expect(metrics.find(row => row.id === 'monitoring.pooledAUC')?.validity).toBe('unavailable');
    expect(formatAuditNumber(.00000002)).not.toBe('0');
    expect(summary.audit?.leafBins.reduce((total, bin) => total + bin.leaves, 0)).toBe(6);
    expect(summary.audit?.leafBins.every(bin => bin.logCountFrom === 0)).toBe(true);
    const invalid = example(); delete invalid.trees[1].gain;
    const partial = analyseModel(invalid).summary;
    expect(partial.audit?.predictors[0].gain).toBe(.00001);
    expect(partial.audit?.predictors.every(row => row.gainShare === null)).toBe(true);
    expect(partial.audit?.trees[1].gain).toBeNull();
    expect(partial.modelEvidence?.structure.missingChecks).toBe(1);
  });
  it('bins all numeric splits and signed leaves, including extreme finite values without overflow', () => {
    const model = example();
    model.trees = [-Number.MAX_VALUE, 0, Number.MAX_VALUE].map(value => ({ ...model.trees[1], split: `IH.Web.Clicked.Recency < ${value}`, condition: parseSplit(`IH.Web.Clicked.Recency < ${value}`), left: { score: -Number.MAX_VALUE, sampleCount: 0 }, right: { score: Number.MAX_VALUE, sampleCount: Number.MAX_SAFE_INTEGER } }));
    const audit = analyseModel(model).summary.audit!;
    expect(audit.predictors[0].thresholdBins.reduce((total, bin) => total + bin.count, 0)).toBe(3);
    expect(audit.predictors[0].thresholdBins.every(bin => Number.isFinite(bin.from) && Number.isFinite(bin.to))).toBe(true);
    expect(audit.leafBins.reduce((total, bin) => total + bin.leaves, 0)).toBe(6);
    expect(audit.leafBins.every(bin => Number.isFinite(bin.scoreFrom) && Number.isFinite(bin.scoreTo))).toBe(true);
  });
  it('preserves subnormal ranges without NaN bins and discloses precision-limited threshold bins', () => {
    expect(rangeFraction(Number.MIN_VALUE, 0, Number.MIN_VALUE)).toBe(1);
    expect(interpolateRange(Number.MIN_VALUE, Number.MIN_VALUE, .5)).toBe(Number.MIN_VALUE);
    expect(interpolateRange(-1, 1e-16, 1)).toBe(1e-16);
    const model = example();
    model.trees = [0, Number.MIN_VALUE].map(value => ({ ...model.trees[1], split: `Tiny < ${value}`, condition: parseSplit(`Tiny < ${value}`), left: { score: value, sampleCount: 0 }, right: { score: value, sampleCount: 0 } }));
    const audit = analyseModel(model).summary.audit!;
    expect(audit.predictors[0].thresholdBins).toEqual([{ from: 0, to: Number.MIN_VALUE, count: 2 }]);
    expect(audit.leafBins.reduce((total, bin) => total + bin.leaves, 0)).toBe(4);
  });
  it('assigns exact stored boundaries to the lower-inclusive bin despite floating-point division error', () => {
    const model = example();
    const minimum = -3, maximum = .7, boundary = interpolateRange(minimum, maximum, 3 / 12);
    model.trees = [minimum, boundary, maximum].map(value => ({
      ...model.trees[1], split: `Boundary < ${value}`, condition: parseSplit(`Boundary < ${value}`),
    }));
    const bins = analyseModel(model).summary.audit!.predictors[0].thresholdBins;
    expect(bins).toHaveLength(12);
    expect(bins[2].to).toBe(boundary);
    expect(bins[2].count).toBe(0);
    expect(bins[3].from).toBe(boundary);
    expect(bins[3].count).toBe(1);
    expect(bins[0].count).toBe(1);
    expect(bins[11].count).toBe(1);
  });
  it('hashes observed sets independent of order and detects equal-cardinality membership replacements in evolution', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const early = analyseModel(example()), laterModel = example();
    laterModel.trees[2] = { ...laterModel.trees[2], split: 'Customer.Product in { 12, C }', condition: parseSplit('Customer.Product in { 12, C }') };
    laterModel.trees[1] = { ...laterModel.trees[1], split: 'IH.Web.Clicked.Recency < 4', condition: parseSplit('IH.Web.Clicked.Recency < 4'), gain: .00004 };
    const late = analyseModel(laterModel);
    await hashAuditCategories(early.summary.audit!, early.categories);
    await hashAuditCategories(late.summary.audit!, late.categories);
    const snapshot = (model: AGBModel, summary: typeof early.summary, id: string) => ({ ...summarizeEvolution({ model, issues: [], nodeCount: 9, maxDepth: 1 }, summary), id, name: id, timeSource: 'missing' as const });
    const comparison = compareSnapshots(snapshot(example(), early.summary, 'early'), snapshot(laterModel, late.summary, 'late'));
    expect(comparison.membershipChanges).toHaveLength(1);
    expect(comparison.membershipChanges[0].before.observedCategories).toBe(2);
    expect(comparison.membershipChanges[0].after.observedCategories).toBe(2);
    expect(comparison.thresholdChanges).toHaveLength(1);
    expect(comparison.gainMovers.some(row => row.delta !== null && row.delta !== 0)).toBe(true);
    const reordered = example();
    reordered.trees[2] = { ...reordered.trees[2], condition: parseSplit('Customer.Product in { 12, "A,B", 12 }') };
    const same = analyseModel(reordered);
    await hashAuditCategories(same.summary.audit!, same.categories);
    expect(same.summary.audit?.predictors[2].categoryDigest).toBe(early.summary.audit?.predictors[2].categoryDigest);
  });
  it('exports script-free escaped HTML and exact JSON/CSV/figure evidence without zero-filling or raw forests', async () => {
    vi.stubGlobal('Blob', NodeBlob);
    const model = example();
    model.trees[0].condition = parseSplit('=Customer.<script>alert(1)</script> is Missing');
    const { summary } = analyseModel(model);
    summary.sourceDigest = 'a'.repeat(64);
    const html = await buildAuditExport(summary, [], 'html').text();
    expect(html).toContain('<html lang="en">');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('default-src \'none\'');
    expect(html).toContain('Not available');
    const bundle = JSON.parse(await buildAuditExport(summary, [], 'json').text());
    expect(bundle.manifest.source.digest).toBe('a'.repeat(64));
    expect(bundle.manifest.analysis.trees[0].gain).toBe(.00001);
    expect(bundle.manifest.analysis.trees[0]).not.toHaveProperty('left');
    expect(bundle.manifest.metrics.every((row: { unit: string; method: string; operands: object; validity: string }) => row.unit && row.method && row.operands && row.validity)).toBe(true);
    expect(bundle.files['predictors.csv']).toContain("\"'=Customer.");
    expect(bundle.figures.leafDensity).toHaveLength(summary.audit!.leafBins.length);
    expect(() => buildAuditExport({ ...summary, sourceDigest: undefined }, [], 'json')).toThrow(/hash/);
  });
  it('keeps importer counter validation strict rather than truncating fractional counts', () => {
    const result = validateAGBExport({ type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST', model: { booster: { trees: [{ score: 0, sampleCount: 100.5 }] } } }, 100);
    expect(result.model).toBeNull();
    expect(result.issues[0].message).toMatch(/safe integer/);
  });
});
