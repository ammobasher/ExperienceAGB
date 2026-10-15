import type { AGBModel, TreeNode } from './agb';
import type { ModelEvidence } from './modelEvidence';
import { DECIMAL_VALUE } from './split';

export const AUDIT_VERSION = 'agb-local-audit-v1';
export const literalNamespace = (feature: string) => feature.includes('.') ? feature.slice(0, feature.indexOf('.')) : '(unqualified)';
export function inferredRole(feature: string): string {
  if (/Propensity|Score|Classifier|Probability|Prediction/i.test(feature)) return 'Score-like name (provenance unverified)';
  if (feature.startsWith('IH.')) return 'Interaction History (name-based)';
  if (['pyIssue', 'pyGroup', 'pyName', 'pyTreatment', 'pyDirection', 'pyChannel'].includes(feature)) return 'Model context (name-based)';
  if (feature.startsWith('Param.')) return 'Serving context (name-based)';
  if (feature.startsWith('Customer.')) return 'Customer attribute (name-based)';
  return 'Not inferred';
}
export interface ThresholdBin { from: number; to: number; count: number }
export interface AuditPredictor {
  feature: string; namespace: string; role: string; splitCount: number; rootCount: number;
  gain: number | null; gainShare: number | null; meanDepth: number;
  numericSplits: number; membershipSplits: number; missingChecks: number;
  minimumThreshold: number | null; maximumThreshold: number | null; thresholdBins: ThresholdBin[];
  observedCategories: number; numericLookingSplits: number; singletonSplits: number; categoryDigest: string | null;
  firstOccurrence: { treeIndex: number; nodeId: string };
}
export interface AuditTree {
  treeIndex: number; nodes: number; leaves: number; depthEdges: number; rootCount: number;
  gain: number | null; cumulativeGain: number | null; minimumLeafScore: number; maximumLeafScore: number;
}
export interface LeafBin {
  scoreFrom: number; scoreTo: number; logCountFrom: number; logCountTo: number; leaves: number;
  treeIndex: number; nodeId: string;
}
export interface ModelAudit {
  version: typeof AUDIT_VERSION;
  predictors: AuditPredictor[]; trees: AuditTree[];
  namespaces: Array<{ namespace: string; predictors: number; splits: number; gain: number | null; gainShare: number | null }>;
  depthNamespaces: Array<{ depth: number; namespace: string; splits: number }>;
  leafBins: LeafBin[];
}
export function finite(value: number): number | null { return Number.isFinite(value) ? value : null; }
export function formatAuditNumber(value: number | null): string {
  if (value === null) return 'Not available';
  if (value === 0) return '0';
  if (Math.abs(value) < .0001 || Math.abs(value) >= 1e9) return value.toExponential(6);
  return value.toLocaleString(undefined, { maximumSignificantDigits: 9 });
}
export function rangeFraction(value: number, minimum: number, maximum: number) {
  if (minimum === maximum) return 0;
  const span = maximum - minimum;
  // Direct subtraction preserves subnormals; half-scaled subtraction avoids overflow.
  return Math.max(0, Math.min(1, Number.isFinite(span) ? (value - minimum) / span : (value / 2 - minimum / 2) / (maximum / 2 - minimum / 2)));
}
export function interpolateRange(minimum: number, maximum: number, ratio: number) {
  if (ratio === 0) return minimum;
  if (ratio === 1) return maximum;
  const span = maximum - minimum;
  return Number.isFinite(span) ? minimum + span * ratio : (1 - ratio) * minimum + ratio * maximum;
}

export function computeModelAudit(model: AGBModel, evidence: ModelEvidence): { audit: ModelAudit; categories: Map<string, Set<string>> } {
  const predictors = new Map<string, AuditPredictor>();
  const categories = new Map<string, Set<string>>();
  const invalidGains = new Set<string>();
  const depthNamespaces = new Map<number, Map<string, number>>();
  const trees: AuditTree[] = [];
  let minimumScore = Infinity, maximumScore = -Infinity, maximumLogCount = 0, cumulativeGain: number | null = 0;
  model.trees.forEach((root, treeIndex) => {
    const tree: AuditTree = { treeIndex, nodes: 0, leaves: 0, depthEdges: 0, rootCount: root.sampleCount, gain: 0, cumulativeGain: null, minimumLeafScore: Infinity, maximumLeafScore: -Infinity };
    const pending = [{ node: root, depth: 0, nodeId: 'root' }];
    while (pending.length) {
      const { node, depth, nodeId } = pending.pop()!;
      tree.nodes++; tree.depthEdges = Math.max(tree.depthEdges, depth);
      if (node.split) {
        const usableGain = node.gain !== undefined && node.gain >= 0;
        tree.gain = tree.gain !== null && usableGain ? finite(tree.gain + node.gain!) : null;
        const condition = node.condition;
        if (condition) {
          const feature = condition.feature;
          let row = predictors.get(feature);
          if (!row) {
            row = { feature, namespace: literalNamespace(feature), role: inferredRole(feature), splitCount: 0, rootCount: 0, gain: 0, gainShare: null, meanDepth: 0, numericSplits: 0, membershipSplits: 0, missingChecks: 0, minimumThreshold: null, maximumThreshold: null, thresholdBins: [], observedCategories: 0, numericLookingSplits: 0, singletonSplits: 0, categoryDigest: null, firstOccurrence: { treeIndex, nodeId } };
            predictors.set(feature, row);
          }
          row.splitCount++; row.meanDepth += depth;
          if (depth === 0) row.rootCount++;
          if (!usableGain) invalidGains.add(feature);
          else row.gain = row.gain === null ? null : finite(row.gain + node.gain!);
          const depths = depthNamespaces.get(depth) ?? new Map<string, number>();
          depths.set(row.namespace, (depths.get(row.namespace) ?? 0) + 1); depthNamespaces.set(depth, depths);
          if (condition.operator === 'lt' && condition.threshold !== undefined) {
            row.numericSplits++;
            row.minimumThreshold = Math.min(row.minimumThreshold ?? Infinity, condition.threshold);
            row.maximumThreshold = Math.max(row.maximumThreshold ?? -Infinity, condition.threshold);
          } else if (condition.operator === 'missing') row.missingChecks++;
          else if (condition.operator === 'in') {
            row.membershipSplits++;
            const values = categories.get(feature) ?? new Set<string>();
            for (const value of condition.categories ?? []) values.add(value);
            categories.set(feature, values);
            if (condition.categories?.some(value => DECIMAL_VALUE.test(value))) row.numericLookingSplits++;
            if (condition.categories?.length === 1) row.singletonSplits++;
          }
        }
      } else {
        tree.leaves++;
        tree.minimumLeafScore = Math.min(tree.minimumLeafScore, node.score);
        tree.maximumLeafScore = Math.max(tree.maximumLeafScore, node.score);
        minimumScore = Math.min(minimumScore, node.score); maximumScore = Math.max(maximumScore, node.score);
        maximumLogCount = Math.max(maximumLogCount, Math.log1p(node.sampleCount));
      }
      if (node.right) pending.push({ node: node.right, depth: depth + 1, nodeId: `${nodeId}.R` });
      if (node.left) pending.push({ node: node.left, depth: depth + 1, nodeId: `${nodeId}.L` });
    }
    cumulativeGain = cumulativeGain !== null && tree.gain !== null ? finite(cumulativeGain + tree.gain) : null;
    tree.cumulativeGain = cumulativeGain;
    trees.push(tree);
  });
  const totalGain = evidence.gain.totalInternalGain;
  const share = (value: number | null) => value !== null && totalGain !== null && totalGain > 0 ? Math.min(1, value / totalGain) : null;
  const namespaces = new Map<string, ModelAudit['namespaces'][number]>();
  for (const row of predictors.values()) {
    if (invalidGains.has(row.feature)) row.gain = null;
    row.gainShare = share(row.gain); row.meanDepth /= row.splitCount;
    row.observedCategories = categories.get(row.feature)?.size ?? 0;
    if (row.minimumThreshold !== null && row.maximumThreshold !== null) {
      const boundaries = Array.from({ length: 13 }, (_, index) => interpolateRange(row.minimumThreshold!, row.maximumThreshold!, index / 12));
      const count = boundaries.some((value, index) => index > 0 && value <= boundaries[index - 1]) ? 1 : 12;
      row.thresholdBins = Array.from({ length: count }, (_, index) => ({ from: interpolateRange(row.minimumThreshold!, row.maximumThreshold!, index / count), to: interpolateRange(row.minimumThreshold!, row.maximumThreshold!, (index + 1) / count), count: 0 }));
    }
    const group = namespaces.get(row.namespace) ?? { namespace: row.namespace, predictors: 0, splits: 0, gain: 0, gainShare: null };
    group.predictors++; group.splits += row.splitCount;
    group.gain = group.gain !== null && row.gain !== null ? finite(group.gain + row.gain) : null;
    namespaces.set(row.namespace, group);
  }
  const leafBins = new Map<number, LeafBin>();
  model.trees.forEach((root, treeIndex) => {
    const pending: Array<{ node: TreeNode; nodeId: string }> = [{ node: root, nodeId: 'root' }];
    while (pending.length) {
      const { node, nodeId } = pending.pop()!;
      if (node.condition?.operator === 'lt') {
        const row = predictors.get(node.condition.feature)!;
        const index = row.thresholdBins.findIndex((bin, index, bins) => index === bins.length - 1 || node.condition!.threshold! < bin.to);
        row.thresholdBins[index].count++;
      } else if (!node.split) {
        const x = Math.min(23, Math.floor(rangeFraction(node.score, minimumScore, maximumScore) * 24));
        const y = maximumLogCount ? Math.min(15, Math.floor(Math.log1p(node.sampleCount) / maximumLogCount * 16)) : 0;
        const key = y * 24 + x;
        const bin = leafBins.get(key) ?? { scoreFrom: interpolateRange(minimumScore, maximumScore, x / 24), scoreTo: interpolateRange(minimumScore, maximumScore, (x + 1) / 24), logCountFrom: y / 16 * maximumLogCount, logCountTo: (y + 1) / 16 * maximumLogCount, leaves: 0, treeIndex, nodeId };
        bin.leaves++; leafBins.set(key, bin);
      }
      if (node.right) pending.push({ node: node.right, nodeId: `${nodeId}.R` });
      if (node.left) pending.push({ node: node.left, nodeId: `${nodeId}.L` });
    }
  });
  for (const group of namespaces.values()) group.gainShare = share(group.gain);
  return {
    audit: {
      version: AUDIT_VERSION, predictors: [...predictors.values()], trees,
      namespaces: [...namespaces.values()].sort((a, b) => a.namespace.localeCompare(b.namespace)),
      depthNamespaces: [...depthNamespaces].flatMap(([depth, values]) => [...values].map(([namespace, splits]) => ({ depth, namespace, splits }))),
      leafBins: [...leafBins.values()],
    },
    categories,
  };
}

export async function sha256(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function hashAuditCategories(audit: ModelAudit, categories: Map<string, Set<string>>) {
  const rows = audit.predictors.filter(row => categories.has(row.feature));
  for (let index = 0; index < rows.length; index += 16) {
    await Promise.all(rows.slice(index, index + 16).map(async row => {
      row.categoryDigest = await sha256(new TextEncoder().encode(JSON.stringify([...categories.get(row.feature)!].sort())));
    }));
  }
}
