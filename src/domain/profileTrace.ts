import type { TreeNode } from './agb';
import { DECIMAL_VALUE, parseSplit } from './split';
import { explainNode } from './explanations';

export type ProfileFeature = {
  name: string;
  kind: 'number' | 'category' | 'missing' | 'unsupported';
  suggestedValue: string;
  thresholds: number[];
  categories: string[];
};

export type StageTrace = {
  treeIndex: number;
  complete: boolean;
  path: string[];
  leaf?: TreeNode;
  issue?: { feature: string; reason: 'missing-value' | 'invalid-number' | 'unsupported-split' | 'unknown-category'; message: string };
  steps?: Array<{ nodeId: string; question: string; branch: 'True / Left' | 'False / Right'; feature: string; value: string }>;
};

export type EnsembleTrace = {
  stages: StageTrace[];
  runningScores: Array<number | undefined>;
  complete: boolean;
  rawScore?: number;
  propensity?: number;
  arithmeticIssue?: string;
};

const featureCache = new WeakMap<TreeNode[], ProfileFeature[]>();
export function traceEnsemblePreview(trees: TreeNode[], values: Record<string, string>, suppliedFeatures?: ProfileFeature[]): EnsembleTrace {
  let features = suppliedFeatures ?? featureCache.get(trees);
  if (!features) { features = buildProfileFeatures(trees); featureCache.set(trees, features); }
  const featureMap = new Map(features.map(feature => [feature.name, feature]));
  const stages = trees.map((tree, index) => traceTreePreview(tree, index, values, featureMap));
  const runningScores: Array<number | undefined> = [];
  let runningScore = 0;
  let prefixComplete = true;
  let arithmeticIssue: string | undefined;

  for (const stage of stages) {
    if (!stage.complete) {
      prefixComplete = false;
      runningScores.push(undefined);
      continue;
    }
    if (!prefixComplete) {
      runningScores.push(undefined);
      continue;
    }
    const nextScore = runningScore + stage.leaf!.score;
    if (!Number.isFinite(nextScore)) {
      arithmeticIssue = `Tree ${stage.treeIndex + 1}: leaf-score accumulation exceeds the finite numeric range. No preview can be calculated.`;
      prefixComplete = false;
      runningScores.push(undefined);
      continue;
    }
    runningScore = nextScore;
    runningScores.push(runningScore);
  }

  const complete = stages.every((stage) => stage.complete) && !arithmeticIssue;
  return {
    stages,
    runningScores,
    complete,
    rawScore: complete ? runningScore : undefined,
    propensity: complete ? agbPropensityFromRawScore(runningScore) : undefined,
    arithmeticIssue,
  };
}

export function agbPropensityFromRawScore(rawScore: number): number {
  if (rawScore >= 0) return 1 / (1 + Math.exp(-rawScore));
  const exponential = Math.exp(rawScore);
  return exponential / (1 + exponential);
}

export function buildProfileFeatures(trees: TreeNode[]): ProfileFeature[] {
  const featureMap = new Map<string, { thresholds: number[]; categories: string[]; operators: Set<string> }>();
  const pending = [...trees];
  while (pending.length) {
    const node = pending.pop();
    if (!node) continue;
    if (node.split) {
      const parsed = node.condition ?? parseSplit(node.split);
      const current = featureMap.get(parsed.feature) ?? { thresholds: [], categories: [], operators: new Set<string>() };
      current.operators.add(parsed.operator);
      if (parsed.operator === 'lt' && parsed.threshold !== undefined) current.thresholds.push(parsed.threshold);
      if (parsed.operator === 'in') for (const category of parsed.categories ?? []) current.categories.push(category);
      featureMap.set(parsed.feature, current);
    }
    if (node.left) pending.push(node.left);
    if (node.right) pending.push(node.right);
  }

  return Array.from(featureMap, ([name, values]) => {
    const thresholds = [...new Set(values.thresholds)].sort((left, right) => left - right);
    const categories = [...new Set(values.categories)].sort((left, right) => left.localeCompare(right));
    const kind: ProfileFeature['kind'] = values.operators.has('unknown') || (values.operators.has('lt') && values.operators.has('in'))
      ? 'unsupported'
      : thresholds.length
        ? 'number'
        : categories.length
          ? 'category'
          : 'missing';
    const suggestedValue = kind === 'number'
      ? String(thresholds[0] ?? '')
      : kind === 'category'
        ? categories[0] ?? ''
        : '';
    return { name, kind, suggestedValue, thresholds, categories };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

export function createIllustrativeProfile(features: ProfileFeature[], variant = 0): Record<string, string> {
  return Object.fromEntries(features.map((feature) => {
    if (feature.kind === 'number' && feature.thresholds.length) {
      return [feature.name, String(feature.thresholds[variant % feature.thresholds.length])];
    }
    if (feature.kind === 'category' && feature.categories.length) {
      return [feature.name, feature.categories[variant % feature.categories.length]];
    }
    return [feature.name, ''];
  }));
}

export function traceTreePreview(tree: TreeNode, treeIndex: number, values: Record<string, string>, featureMap = new Map(buildProfileFeatures([tree]).map(feature => [feature.name, feature]))): StageTrace {
  const path = ['root'];
  const steps: NonNullable<StageTrace['steps']> = [];
  let node = tree;
  let nodePath = 'root';

  while (node.split) {
    const split = node.condition ?? parseSplit(node.split);
    if (split.operator === 'unknown') {
      return incomplete(treeIndex, path, split.feature, 'unsupported-split', split.error ?? 'This split is unsupported.', steps);
    }
    const value = Object.hasOwn(values, split.feature) ? values[split.feature] : '';
    const feature = featureMap.get(split.feature);
    const state = feature ? getProfileValueState(feature, value) : 'Unsupported';
    if (state === 'Unsupported') return incomplete(treeIndex, path, split.feature, 'unsupported-split', 'This predictor has unsupported or mixed numeric/categorical conditions. No route was assumed.', steps);
    if (state === 'Unknown category') return incomplete(treeIndex, path, split.feature, 'unknown-category', `The supplied category for ${split.feature} is not present in the export. Unknown-category routing is unverified; choose an exact exported value.`, steps);
    if (state === 'Invalid number') return incomplete(treeIndex, path, split.feature, 'invalid-number', `${split.feature} must be a finite decimal number; hexadecimal and nonnumeric values are unsupported.`, steps);
    const evaluation = evaluatePreview(split, value, state === 'Missing');
    if (!evaluation.complete) return incomplete(treeIndex, path, split.feature, evaluation.reason, evaluation.message, steps);
    const side = evaluation.left ? 'L' : 'R';
    const next = evaluation.left ? node.left : node.right;
    if (!next) return incomplete(treeIndex, path, split.feature, 'unsupported-split', 'This split is missing the selected child.', steps);
    steps.push({ nodeId: nodePath, feature: split.feature, value, question: explainNode(node).question, branch: evaluation.left ? 'True / Left' : 'False / Right' });
    node = next;
    nodePath = `${nodePath}.${side}`;
    path.push(nodePath);
  }

  return { treeIndex, complete: true, path, leaf: node, steps };
}

export function getProfileValueState(feature: ProfileFeature, value: string): 'Supplied' | 'Missing' | 'Invalid number' | 'Unknown category' | 'Unsupported' {
  if (feature.kind === 'unsupported') return 'Unsupported';
  if (feature.kind === 'category' ? value === '' : value.trim() === '') return 'Missing';
  if (feature.kind === 'number' && (!DECIMAL_VALUE.test(value.trim()) || !Number.isFinite(Number(value)))) return 'Invalid number';
  if (feature.kind === 'category' && !feature.categories.includes(value)) return 'Unknown category';
  return 'Supplied';
}

function evaluatePreview(split: ReturnType<typeof parseSplit>, rawValue: string, missing: boolean):
  | { complete: true; left: boolean }
  | { complete: false; reason: 'missing-value' | 'invalid-number'; message: string } {
  if (split.operator === 'missing') return { complete: true, left: missing };
  if (rawValue === '' || (split.operator !== 'in' && rawValue.trim() === '')) {
    return { complete: false, reason: 'missing-value', message: `Enter a value for ${split.feature}; no branch was assumed.` };
  }
  if (split.operator === 'lt') {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      return { complete: false, reason: 'invalid-number', message: `${split.feature} must be a finite number.` };
    }
    return { complete: true, left: numeric < (split.threshold as number) };
  }
  return { complete: true, left: (split.categories ?? []).includes(rawValue) };
}

function incomplete(
  treeIndex: number,
  path: string[],
  feature: string,
  reason: StageTrace['issue'] extends infer Issue ? Issue extends { reason: infer Reason } ? Reason : never : never,
  message: string,
  steps: StageTrace['steps'],
): StageTrace {
  return { treeIndex, complete: false, path, steps, issue: { feature, reason, message } };
}