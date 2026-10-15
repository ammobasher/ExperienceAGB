import { AUDIT_NAMESPACES } from '../domain/modelEvidence.ts';

export function validateModelEvidence(value: unknown, fail: () => never) {
  if (value === null) return;
  const check = (condition: boolean) => { if (!condition) fail(); };
  function object(value: unknown, fields: string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
    const result = value as Record<string, unknown>;
    check(Object.keys(result).length === fields.length && fields.every(field => Object.hasOwn(result, field)));
    return result;
  }
  const count = (value: unknown, maximum = 250000, minimum = 0) => check(typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum);
  const numeric = (value: unknown) => check(value === null || typeof value === 'number' && Number.isFinite(value));
  const proportion = (value: unknown) => { numeric(value); check(value === null || typeof value === 'number' && value >= 0 && value <= 1); };
  const booleanOrNull = (value: unknown) => check(value === null || typeof value === 'boolean');
  const array = (value: unknown, limit: number): unknown[] => { if (!Array.isArray(value) || value.length > limit) return fail(); return value; };
  const sum = (values: unknown[]) => values.reduce<number>((total, value) => total + Number(value), 0);
  const e = object(value, ['version', 'coverage', 'monitoring', 'structure', 'gain', 'distinctPredictors', 'predictorsTruncated', 'predictors', 'namespaces']);
  check(e.version === 'whole-model-v2');
  const c = object(e.coverage, ['fileBytes', 'trees', 'nodes', 'internalNodes', 'leaves', 'binaryLeafInvariant']);
  if (c.fileBytes !== null) count(c.fileBytes, 25 * 1024 * 1024, 1);
  count(c.trees, 2000, 1); count(c.nodes, 250000, 1); count(c.internalNodes); count(c.leaves, 250000, 1);
  check(Number(c.internalNodes) + Number(c.leaves) === c.nodes);
  check(c.binaryLeafInvariant === (c.leaves === Number(c.internalNodes) + Number(c.trees)));
  const m = object(e.monitoring, ['positiveCount', 'negativeCount', 'totalCount', 'baseSuccessRate', 'exportedSuccessRate', 'pooledAUC', 'successRateMatchesTraining']);
  for (const key of ['positiveCount', 'negativeCount', 'totalCount']) if (m[key] !== null) count(m[key], Number.MAX_SAFE_INTEGER);
  check(['positiveCount', 'negativeCount', 'totalCount'].every(key => (m[key] === null) === (m.totalCount === null)));
  if (m.totalCount !== null) check(Number(m.positiveCount) + Number(m.negativeCount) === m.totalCount);
  for (const key of ['baseSuccessRate', 'exportedSuccessRate', 'pooledAUC']) proportion(m[key]);
  check(m.baseSuccessRate === (m.totalCount !== null && Number(m.totalCount) > 0 ? Number(m.positiveCount) / Number(m.totalCount) : null));
  booleanOrNull(m.successRateMatchesTraining);
  check(m.successRateMatchesTraining === (m.baseSuccessRate !== null && m.exportedSuccessRate !== null ? m.baseSuccessRate === m.exportedSuccessRate : null));
  const s = object(e.structure, ['maximumDepthEdges', 'stumpTrees', 'lessThanSplits', 'membershipSplits', 'missingChecks', 'unparsedSplits', 'numericLookingMembershipSplits', 'singletonMembershipSplits', 'firstRootSampleCount', 'lastRootSampleCount', 'rootCountsStrictlyDecrease', 'firstRootEqualsTraining', 'sampleCountConserved', 'sampleCountNotConserved', 'leafDepthCounts']);
  count(s.maximumDepthEdges, 64); count(s.stumpTrees, Number(c.trees));
  for (const key of ['lessThanSplits', 'membershipSplits', 'missingChecks', 'unparsedSplits', 'sampleCountConserved', 'sampleCountNotConserved']) count(s[key], Number(c.internalNodes));
  check(sum([s.lessThanSplits, s.membershipSplits, s.missingChecks, s.unparsedSplits]) === c.internalNodes);
  count(s.numericLookingMembershipSplits, Number(s.membershipSplits));
  count(s.singletonMembershipSplits, Number(s.membershipSplits));
  check(sum([s.sampleCountConserved, s.sampleCountNotConserved]) === c.internalNodes);
  count(s.firstRootSampleCount, Number.MAX_SAFE_INTEGER); count(s.lastRootSampleCount, Number.MAX_SAFE_INTEGER);
  check(typeof s.rootCountsStrictlyDecrease === 'boolean');
  booleanOrNull(s.firstRootEqualsTraining);
  check(s.firstRootEqualsTraining === (m.totalCount === null ? null : s.firstRootSampleCount === m.totalCount));
  const depths = array(s.leafDepthCounts, 65).map(row => {
    const item = object(row, ['depth', 'count']);
    count(item.depth, Number(s.maximumDepthEdges)); count(item.count, Number(c.leaves), 1);
    return item;
  });
  check(sum(depths.map(row => row.count)) === c.leaves);
  check(depths.every((row, index) => index === 0 || Number(row.depth) > Number(depths[index - 1].depth)));
  check(depths.at(-1)?.depth === s.maximumDepthEdges);
  const g = object(e.gain, ['missingInternalGains', 'negativeInternalGains', 'missingLeafGains', 'nonzeroLeafGains', 'totalInternalGain', 'firstQuarterShare', 'lastQuarterShare', 'meanGainFirstHalf', 'meanGainLastHalf', 'topPredictorGainShare', 'normalizedPredictorGainEntropy', 'scoreDecayRatio', 'rootScoreSum', 'baseRateLogit', 'rootScoreBaseRateResidual']);
  for (const key of ['missingInternalGains', 'negativeInternalGains']) count(g[key], Number(c.internalNodes));
  for (const key of ['missingLeafGains', 'nonzeroLeafGains']) count(g[key], Number(c.leaves));
  check(sum([g.missingInternalGains, g.negativeInternalGains]) <= Number(c.internalNodes));
  check(sum([g.missingLeafGains, g.nonzeroLeafGains]) <= Number(c.leaves));
  for (const [key, field] of Object.entries(g)) {
    numeric(field);
    if (!['rootScoreSum', 'baseRateLogit', 'rootScoreBaseRateResidual'].includes(key)) check(field === null || Number(field) >= 0);
  }
  for (const key of ['firstQuarterShare', 'lastQuarterShare', 'topPredictorGainShare', 'normalizedPredictorGainEntropy']) proportion(g[key]);
  if (Number(g.missingInternalGains) > 0 || Number(g.negativeInternalGains) > 0) check(g.totalInternalGain === null);
  const usableShares = g.totalInternalGain !== null && Number(g.totalInternalGain) > 0;
  if (!usableShares) check(['firstQuarterShare', 'lastQuarterShare', 'topPredictorGainShare', 'normalizedPredictorGainEntropy'].every(key => g[key] === null));
  const expectedLogit = m.baseSuccessRate !== null && Number(m.baseSuccessRate) > 0 && Number(m.baseSuccessRate) < 1 ? Math.log(Number(m.baseSuccessRate) / (1 - Number(m.baseSuccessRate))) : null;
  check(g.baseRateLogit === expectedLogit);
  const residual = g.rootScoreSum !== null && expectedLogit !== null ? Number(g.rootScoreSum) - expectedLogit : null;
  check(g.rootScoreBaseRateResidual === (residual !== null && Number.isFinite(residual) ? residual : null));
  count(e.distinctPredictors, Number(c.internalNodes)); check(e.predictorsTruncated === (Number(e.distinctPredictors) > 8));
  const slots = new Set<unknown>();
  const predictors = array(e.predictors, 8).map(row => {
    const item = object(row, ['slot', 'namespace', 'splitCount', 'rootSplitCount', 'gainShare', 'meanSplitDepth']);
    count(item.slot, Number(e.distinctPredictors), 1); check(!slots.has(item.slot)); slots.add(item.slot);
    check(AUDIT_NAMESPACES.some(category => category === item.namespace));
    count(item.splitCount, Number(c.internalNodes), 1); count(item.rootSplitCount, Math.min(Number(c.trees), Number(item.splitCount)));
    proportion(item.gainShare); check((item.gainShare !== null) === usableShares);
    check(typeof item.meanSplitDepth === 'number' && Number.isFinite(item.meanSplitDepth) && item.meanSplitDepth >= 0 && item.meanSplitDepth <= Number(s.maximumDepthEdges));
    return item;
  });
  check(predictors.length === Math.min(8, Number(e.distinctPredictors)));
  check(g.topPredictorGainShare === (predictors[0]?.gainShare ?? null));
  const categories = new Set<unknown>();
  const namespaces = array(e.namespaces, AUDIT_NAMESPACES.length).map(row => {
    const item = object(row, ['namespace', 'splitCount', 'gainShare']);
    check(AUDIT_NAMESPACES.some(category => category === item.namespace) && !categories.has(item.namespace)); categories.add(item.namespace);
    count(item.splitCount, Number(c.internalNodes)); proportion(item.gainShare);
    check((item.gainShare !== null) === usableShares);
    return item;
  });
  check(namespaces.length === AUDIT_NAMESPACES.length);
  check(sum(namespaces.map(item => item.splitCount)) <= Number(c.internalNodes));
  if (s.unparsedSplits === 0) {
    check(sum(namespaces.map(item => item.splitCount)) === c.internalNodes);
    if (usableShares) check(Math.abs(sum(namespaces.map(item => item.gainShare)) - 1) <= EVIDENCE_RATIO_TOLERANCE);
  }
}
import { EVIDENCE_RATIO_TOLERANCE } from '../domain/modelEvidence.ts';
