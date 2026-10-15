import type { AGBModel, TreeNode } from './agb';
import { DECIMAL_VALUE } from './split.ts';

export const AUDIT_NAMESPACES = ['model-context', 'interaction-history', 'customer', 'serving-context', 'other'] as const;
export const EVIDENCE_RATIO_TOLERANCE = 1e-10;
type Namespace = typeof AUDIT_NAMESPACES[number];
const numberOrNull = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? value : null;
const sum = (values: number[]) => numberOrNull(values.reduce((total, value) => total + value, 0));
function namespace(feature: string): Namespace {
  if (['pyIssue', 'pyGroup', 'pyName', 'pyTreatment', 'pyDirection', 'pyChannel'].includes(feature)) return 'model-context';
  if (feature.startsWith('IH.')) return 'interaction-history';
  if (feature.startsWith('Customer.')) return 'customer';
  if (feature.startsWith('Param.')) return 'serving-context';
  return 'other';
}

/** Run in the import worker. Disclose aggregates, never source strings or raw nodes. */
export function computeModelEvidence(model: AGBModel, fileBytes?: number) {
  let nodes = 0, internalNodes = 0, leaves = 0, maximumDepthEdges = 0;
  let lessThanSplits = 0, membershipSplits = 0, missingChecks = 0, unparsedSplits = 0;
  let numericLookingMembershipSplits = 0, singletonMembershipSplits = 0;
  let missingInternalGains = 0, negativeInternalGains = 0, missingLeafGains = 0, nonzeroLeafGains = 0;
  let sampleCountConserved = 0, sampleCountNotConserved = 0;
  const leafDepths = new Map<number, number>();
  const treeGains: number[] = [];
  const predictors = new Map<string, { slot: number; namespace: Namespace; splitCount: number; rootSplitCount: number; gain: number; depthSum: number }>();
  let stumpTrees = 0;
  for (const root of model.trees) {
    if (!root.split) stumpTrees++;
    let treeGain = 0;
    const pending: { node: TreeNode; depth: number }[] = [{ node: root, depth: 0 }];
    while (pending.length) {
      const { node, depth } = pending.pop()!;
      nodes++; maximumDepthEdges = Math.max(maximumDepthEdges, depth);
      if (node.split) {
        internalNodes++;
        if (node.gain === undefined) missingInternalGains++;
        else if (node.gain < 0) negativeInternalGains++;
        else treeGain += node.gain;
        if (node.left && node.right && node.left.sampleCount + node.right.sampleCount === node.sampleCount) sampleCountConserved++;
        else sampleCountNotConserved++;
        if (node.condition?.operator === 'lt') lessThanSplits++;
        else if (node.condition?.operator === 'in') {
          membershipSplits++;
          if (node.condition.categories?.some(value => DECIMAL_VALUE.test(value))) numericLookingMembershipSplits++;
          if (node.condition.categories?.length === 1) singletonMembershipSplits++;
        }
        else if (node.condition?.operator === 'missing') missingChecks++;
        else unparsedSplits++;
        const feature = node.condition?.feature;
        if (feature) {
          const item = predictors.get(feature) ?? { slot: predictors.size + 1, namespace: namespace(feature), splitCount: 0, rootSplitCount: 0, gain: 0, depthSum: 0 };
          item.splitCount++; item.depthSum += depth;
          if (depth === 0) item.rootSplitCount++;
          if (node.gain !== undefined && node.gain >= 0) item.gain += node.gain;
          predictors.set(feature, item);
        }
      } else {
        leaves++;
        leafDepths.set(depth, (leafDepths.get(depth) ?? 0) + 1);
        if (node.gain === undefined) missingLeafGains++;
        else if (node.gain !== 0) nonzeroLeafGains++;
      }
      if (node.right) pending.push({ node: node.right, depth: depth + 1 });
      if (node.left) pending.push({ node: node.left, depth: depth + 1 });
    }
    treeGains.push(treeGain);
  }
  const accumulatedGain = sum(treeGains);
  const totalInternalGain = !missingInternalGains && !negativeInternalGains ? accumulatedGain : null;
  const gainShare = (gain: number) => {
    const share = totalInternalGain !== null && totalInternalGain > 0 ? numberOrNull(gain / totalInternalGain) : null;
    // Tree, predictor and namespace accumulation orders can round differently.
    return share !== null && share > 1 && share <= 1 + EVIDENCE_RATIO_TOLERANCE ? 1 : share;
  };
  const allPredictors = [...predictors.values()];
  const ranked = allPredictors.sort((a, b) => (totalInternalGain !== null ? b.gain - a.gain : b.splitCount - a.splitCount) || a.slot - b.slot);
  const quarter = Math.max(1, Math.ceil(model.trees.length / 4));
  const half = Math.ceil(model.trees.length / 2);
  const meanGain = (values: number[]) => totalInternalGain !== null && values.length ? numberOrNull((sum(values) ?? NaN) / values.length) : null;
  const scoreMean = (trees: TreeNode[]) => numberOrNull(trees.reduce((total, tree) => total + Math.abs(tree.score) / trees.length, 0));
  const firstScoreMean = scoreMean(model.trees.slice(0, 10));
  const lastScoreMean = scoreMean(model.trees.slice(-10));
  const baseSuccessRate = model.trainingStats && model.trainingStats.totalCount > 0 ? model.trainingStats.positiveCount / model.trainingStats.totalCount : null;
  const rootScoreSum = sum(model.trees.map(tree => tree.score));
  const baseRateLogit = baseSuccessRate !== null && baseSuccessRate > 0 && baseSuccessRate < 1 ? Math.log(baseSuccessRate / (1 - baseSuccessRate)) : null;
  const entropy = totalInternalGain !== null && totalInternalGain > 0 && predictors.size > 1
    ? -allPredictors.reduce((total, item) => { const share = item.gain / totalInternalGain; return total + (share > 0 ? share * Math.log(share) : 0); }, 0) / Math.log(predictors.size) : null;
  return {
    version: 'whole-model-v2' as const,
    coverage: { fileBytes: fileBytes ?? null, trees: model.trees.length, nodes, internalNodes, leaves, binaryLeafInvariant: leaves === internalNodes + model.trees.length },
    monitoring: { positiveCount: model.trainingStats?.positiveCount ?? null, negativeCount: model.trainingStats?.negativeCount ?? null, totalCount: model.trainingStats?.totalCount ?? null, baseSuccessRate, exportedSuccessRate: model.successRate ?? null, pooledAUC: model.auc ?? null, successRateMatchesTraining: baseSuccessRate !== null && model.successRate !== undefined ? model.successRate === baseSuccessRate : null },
    structure: {
      maximumDepthEdges, stumpTrees, lessThanSplits, membershipSplits, missingChecks, unparsedSplits, numericLookingMembershipSplits, singletonMembershipSplits,
      firstRootSampleCount: model.trees[0]?.sampleCount ?? null, lastRootSampleCount: model.trees.at(-1)?.sampleCount ?? null,
      rootCountsStrictlyDecrease: model.trees.every((tree, index) => index === 0 || tree.sampleCount < model.trees[index - 1].sampleCount),
      firstRootEqualsTraining: model.trainingStats ? model.trees[0]?.sampleCount === model.trainingStats.totalCount : null,
      sampleCountConserved, sampleCountNotConserved,
      leafDepthCounts: [...leafDepths].sort(([a], [b]) => a - b).map(([depth, count]) => ({ depth, count })),
    },
    gain: {
      missingInternalGains, negativeInternalGains, missingLeafGains, nonzeroLeafGains, totalInternalGain,
      firstQuarterShare: gainShare(sum(treeGains.slice(0, quarter)) ?? NaN),
      lastQuarterShare: gainShare(sum(treeGains.slice(-quarter)) ?? NaN),
      meanGainFirstHalf: meanGain(treeGains.slice(0, half)), meanGainLastHalf: meanGain(treeGains.slice(half)),
      topPredictorGainShare: ranked.length ? gainShare(ranked[0].gain) : null,
      normalizedPredictorGainEntropy: entropy === null ? null : Math.min(1, Math.max(0, entropy)),
      scoreDecayRatio: firstScoreMean !== null && firstScoreMean > 0 && lastScoreMean !== null ? numberOrNull(lastScoreMean / firstScoreMean) : null,
      rootScoreSum, baseRateLogit, rootScoreBaseRateResidual: rootScoreSum !== null && baseRateLogit !== null ? numberOrNull(rootScoreSum - baseRateLogit) : null,
    },
    distinctPredictors: predictors.size,
    predictorsTruncated: predictors.size > 8,
    predictors: ranked.slice(0, 8).map(item => ({ slot: item.slot, namespace: item.namespace, splitCount: item.splitCount, rootSplitCount: item.rootSplitCount, gainShare: gainShare(item.gain), meanSplitDepth: item.depthSum / item.splitCount })),
    namespaces: AUDIT_NAMESPACES.map(category => {
      const items = allPredictors.filter(item => item.namespace === category);
      return { namespace: category, splitCount: items.reduce((total, item) => total + item.splitCount, 0), gainShare: gainShare(sum(items.map(item => item.gain)) ?? NaN) };
    }),
  };
}
export type ModelEvidence = ReturnType<typeof computeModelEvidence>;
