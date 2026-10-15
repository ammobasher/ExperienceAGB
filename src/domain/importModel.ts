import type { AGBModel, ImportResult, TreeNode, ValidationIssue } from './agb';
import { parseSplit } from './split.ts';
import type { ParsedSplit } from './split';
import { parseUniqueJSON } from './strictJson.ts';

export const IMPORT_LIMITS = {
  maxFileSizeBytes: 25 * 1024 * 1024,
  maxTrees: 2_000,
  maxNodes: 250_000,
  maxDepth: 64,
} as const;
export const PREVIEW_EXPORT_VERSION = '2';
const OBSERVED_UUID_EXPORT_TAG = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RecordValue = Record<string, unknown>;
function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function isCount(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isSafeInteger(value) && value >= 0;
}
function sizeIssue(size: number): ValidationIssue | undefined {
  if (!Number.isFinite(size) || size < 0) return { severity: 'error', path: '$file', message: 'File size is invalid.' };
  if (size > IMPORT_LIMITS.maxFileSizeBytes) return { severity: 'error', path: '$file', message: 'File exceeds the 25 MB import limit.' };
}
export function parseAGBText(text: string, fileSizeBytes: number): ImportResult {
  const issue = sizeIssue(fileSizeBytes);
  if (issue) return failed([issue]);
  let value: unknown;
  try { value = parseUniqueJSON(text); }
  catch (cause) { return failed([{ severity: 'error', path: '$', message: cause instanceof Error && cause.message.startsWith('Duplicate object keys') ? cause.message : 'This file is not valid JSON.' }]); }
  return validateAGBExport(value, fileSizeBytes);
}

export function validateAGBExport(value: unknown, fileSizeBytes: number): ImportResult {
  const issues: ValidationIssue[] = [];
  let nodeCount = 0, maxDepth = 0, hasError = false, truncated = false;
  const add = (path: string, message: string, severity: ValidationIssue['severity'] = 'error') => {
    if (severity === 'error') hasError = true;
    if (issues.length < 200) issues.push({ severity, path, message });
    else truncated = true;
  };
  const checkKeys = (object: RecordValue, allowed: string[], path: string) => {
    for (const key of Object.keys(object)) {
      if (!allowed.includes(key)) add(`${path}.${key}`, 'Unrecognized field in the observed-shape adapter; unsupported scoring constructs are not ignored.');
    }
  };
  const issue = sizeIssue(fileSizeBytes);
  if (issue) return failed([issue]);
  if (!isRecord(value)) return failed([{ severity: 'error', path: '$', message: 'The JSON root must be an object.' }]);
  checkKeys(value, ['type', 'algorithm', 'modelVersion', 'model', 'factoryUpdateTime', 'trainingStats', 'successRate', 'auc'], '$');
  if (value.type !== 'AdaptiveBoostScoringModel') add('$.type', 'Unsupported Pega model type.');
  if (value.algorithm !== 'GRADIENT_BOOST') add('$.algorithm', 'Unsupported model algorithm.');
  const exportTag = typeof value.modelVersion === 'string' ? value.modelVersion : undefined;
  if (exportTag !== PREVIEW_EXPORT_VERSION && !(exportTag && OBSERVED_UUID_EXPORT_TAG.test(exportTag))) add('$.modelVersion', 'Only the observed sample tag "2" or UUID-v4-tagged export structure is supported for unverified preview. Other tags require adapter evidence; all scoring remains unverified.');
  const model = isRecord(value.model) ? value.model : null;
  const booster = model && isRecord(model.booster) ? model.booster : null;
  if (model) checkKeys(model, ['booster'], '$.model');
  if (booster) checkKeys(booster, ['trees'], '$.model.booster');
  const trees = booster?.trees;
  if (!Array.isArray(trees) || !trees.length) {
    add('$.model.booster.trees', 'The ensemble must contain at least one tree.');
    return failed(issues);
  }
  if (trees.length > IMPORT_LIMITS.maxTrees) add('$.model.booster.trees', 'The model exceeds the tree limit.');
  if (hasError || !exportTag) return failed(issues);
  const conditions = new Map<string, ParsedSplit>();

  function convert(node: unknown, path: string, depth: number): TreeNode | undefined {
    if (++nodeCount > IMPORT_LIMITS.maxNodes) {
      add(path, 'The model exceeds the node limit.');
      return undefined;
    }
    maxDepth = Math.max(maxDepth, depth);
    if (depth > IMPORT_LIMITS.maxDepth) {
      add(path, `Tree depth exceeds the limit of ${IMPORT_LIMITS.maxDepth}.`);
      return undefined;
    }
    if (!isRecord(node)) { add(path, 'Tree node must be an object.'); return undefined; }
    checkKeys(node, ['score', 'sampleCount', 'gain', 'split', 'left', 'right', 'isLeaf'], path);
    if (!isFiniteNumber(node.score)) add(`${path}.score`, 'Node score must be a finite number.');
    if (!isCount(node.sampleCount)) add(`${path}.sampleCount`, 'Sample count must be a non-negative safe integer.');
    if (node.gain !== undefined && !isFiniteNumber(node.gain)) add(`${path}.gain`, 'Gain must be finite when supplied.');
    const hasSplit = Object.hasOwn(node, 'split');
    const hasChildren = Object.hasOwn(node, 'left') || Object.hasOwn(node, 'right');
    if (Object.hasOwn(node, 'isLeaf') && (typeof node.isLeaf !== 'boolean' || node.isLeaf !== !hasSplit)) {
      add(`${path}.isLeaf`, 'The optional isLeaf marker must be boolean and agree with the split/leaf structure.');
    }
    if (hasSplit && (typeof node.split !== 'string' || !node.split.trim())) {
      add(`${path}.split`, 'A supplied split must be a nonempty string; leaves must omit split.');
      return undefined;
    }
    if (!hasSplit && hasChildren) add(path, 'A node with children must define a split condition.');
    let condition: ParsedSplit | undefined;
    if (typeof node.split === 'string') {
      condition = conditions.get(node.split) ?? parseSplit(node.split);
      conditions.set(node.split, condition);
      if (condition.operator === 'unknown') add(`${path}.split`, condition.error ?? 'Unsupported split syntax.');
      if (!Object.hasOwn(node, 'left') || !Object.hasOwn(node, 'right')) add(path, 'A split node must have both left and right children.');
    }
    if (!isFiniteNumber(node.score) || !isCount(node.sampleCount)) return undefined;
    const canonical: TreeNode = { score: node.score, sampleCount: node.sampleCount };
    if (isFiniteNumber(node.gain)) canonical.gain = node.gain;
    if (typeof node.split === 'string' && condition?.operator !== 'unknown') {
      canonical.split = node.split;
      canonical.condition = condition;
      canonical.left = convert(node.left, `${path}.left`, depth + 1);
      canonical.right = convert(node.right, `${path}.right`, depth + 1);
    }
    return canonical;
  }
  const canonicalTrees: TreeNode[] = [];
  for (let index = 0; index < trees.length && nodeCount <= IMPORT_LIMITS.maxNodes; index += 1) {
    const tree = convert(trees[index], `$.model.booster.trees[${index}]`, 0);
    if (tree) canonicalTrees.push(tree);
  }
  let stats: AGBModel['trainingStats'];
  if (value.trainingStats !== undefined) {
    const training = value.trainingStats;
    if (isRecord(training) && isCount(training.positiveCount) && isCount(training.negativeCount) && isCount(training.totalCount)) {
      checkKeys(training, ['positiveCount', 'negativeCount', 'totalCount'], '$.trainingStats');
      if (training.positiveCount + training.negativeCount !== training.totalCount) add('$.trainingStats', 'Positive and negative training counts must sum to totalCount.');
      stats = { positiveCount: training.positiveCount, negativeCount: training.negativeCount, totalCount: training.totalCount };
    } else add('$.trainingStats', 'Training counts must be non-negative safe integers.');
  }
  if (truncated) issues.push({ severity: 'warning', path: '$', message: 'Diagnostic list truncated after 200 entries. Correct these issues and retry.' });
  if (hasError) return failed(issues, nodeCount, maxDepth);
  const canonicalModel: AGBModel = { modelVersion: exportTag, scoringStatus: 'unverified-preview', trees: canonicalTrees, trainingStats: stats };
  if (value.factoryUpdateTime !== undefined) {
    const timestamp = parseTimestamp(value.factoryUpdateTime);
    if (timestamp) canonicalModel.factoryUpdateTime = timestamp;
    else add('$.factoryUpdateTime', 'Unrecognized or invalid UTC timestamp; update time is unknown and omitted.', 'warning');
  }
  for (const key of ['auc', 'successRate'] as const) {
    if (value[key] === undefined) continue;
    if (isFiniteNumber(value[key]) && value[key] >= 0 && value[key] <= 1) canonicalModel[key] = value[key];
    else add(`$.${key}`, 'Expected a finite proportion between zero and one; omitted from metadata.', 'warning');
  }
  return { model: canonicalModel, issues, nodeCount, maxDepth };
}
function failed(issues: ValidationIssue[], nodeCount = 0, maxDepth = 0): ImportResult {
  return { model: null, issues, nodeCount, maxDepth };
}
function parseTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/);
  const normalized = compact ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}.${compact[7]}Z` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(normalized)) return undefined;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) && date.toISOString() === normalized ? normalized : undefined;
}
