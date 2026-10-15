import type { AGBModel, ImportResult, TreeNode } from '../domain/agb';
import type { ModelAnalysis } from '../domain/modelAnalysis';
import type { EnsembleTrace } from '../domain/profileTrace';

export type ContextScope = 'model' | 'tree' | 'node' | 'trace';
export interface ContextSource {
  model: AGBModel;
  analysis: ModelAnalysis;
  result: ImportResult;
  treeIndex: number;
  nodeId: string;
  trace: EnsembleTrace;
}
const finite = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? value : null;

function selectedNode(tree: TreeNode, path: string): TreeNode | undefined {
  if (!/^root(?:\.[LR]){0,64}$/.test(path)) return undefined;
  let node = tree;
  for (const side of path.split('.').slice(1)) {
    const next = side === 'L' ? node.left : node.right;
    if (!next) return undefined;
    node = next;
  }
  return node;
}

/** Allowlist computed facts: export strings, metadata, feature names and raw JSON never enter context. */
export function buildContext(source: ContextSource, scope: ContextScope, includeProfileValues = false) {
  const { model, analysis, result, treeIndex, trace } = source;
  const index = Math.max(0, Math.min(model.trees.length - 1, Math.trunc(treeIndex) || 0));
  const facts = analysis.treeFacts[index];
  const stage = trace.stages[index];
  const base = { scope, scoringStatus: 'unverified-preview', names: 'omitted', modelEvidence: analysis.modelEvidence ?? null, profileValues: includeProfileValues && scope === 'trace' ? 'numeric-only; text redacted' : 'omitted' };
  if (scope === 'model') return { ...base, facts: { trees: model.trees.length, predictors: analysis.predictors.length, nodes: result.nodeCount, deepestPathLevels: result.maxDepth + 1 } };
  if (scope === 'tree') return { ...base, tree: index + 1, facts: { nodes: facts.nodeCount, leaves: facts.leaves, serializedLeafMinimum: finite(facts.minimum), serializedLeafMaximum: finite(facts.maximum) } };
  if (scope === 'node') {
    const node = selectedNode(model.trees[index], source.nodeId);
    if (!node) return { ...base, tree: index + 1, facts: { selectionAvailable: false, reason: 'selection exceeds bounds or is unavailable' } };
    return { ...base, tree: index + 1, facts: { kind: node.split ? 'split' : 'leaf', serializedScore: finite(node.score), exportedSampleCount: finite(node.sampleCount), operator: node.condition?.operator === 'lt' ? 'less-than' : node.condition?.operator === 'in' ? 'membership' : node.split ? 'unsupported' : 'none' } };
  }
  const steps = stage.steps ?? [];
  return {
    ...base, tree: index + 1,
    facts: { routeComplete: stage.complete, resolvedBranches: stage.path.slice(1, 33).map(path => path.endsWith('.L') ? 'left' : 'right'), branchesTruncated: stage.path.length > 33, issue: stage.issue?.reason ?? null, leafContribution: stage.complete ? finite(stage.leaf?.score) : null, runningRawScore: finite(trace.runningScores[index]), ensembleComplete: trace.complete, ensembleRawScore: finite(trace.rawScore), unverifiedPropensityPreview: finite(trace.propensity) },
    ...(includeProfileValues ? { profile: steps.slice(0, 16).map((step, position) => ({ slot: position + 1, value: /^[+-]?(?:\d{1,12}(?:\.\d{1,12})?|\.\d{1,12})$/.test(step.value) ? finite(Number(step.value)) : '[redacted]', branch: step.branch === 'True / Left' ? 'left' : 'right' })), profileTruncated: steps.length > 16 } : {}),
  };
}
