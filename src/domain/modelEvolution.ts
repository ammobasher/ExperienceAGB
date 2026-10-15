import type { ImportResult } from './agb';
import type { ModelAnalysis } from './modelAnalysis';
import type { AuditPredictor, ModelAudit } from './modelAudit';
import { formatAuditNumber } from './modelAudit';

export const EVOLUTION_METRICS = {
  trees: { label: 'Trees in ensemble', group: 'structure', unit: 'count' },
  nodes: { label: 'Nodes across all trees', group: 'structure', unit: 'count' },
  leaves: { label: 'Leaves across all trees', group: 'structure', unit: 'count' },
  depth: { label: 'Deepest path (levels)', group: 'structure', unit: 'count' },
  predictors: { label: 'Unique predictors in ensemble', group: 'structure', unit: 'count' },
  totalCount: { label: 'Total training count', group: 'training', unit: 'count' },
  positiveCount: { label: 'Positive training count', group: 'training', unit: 'count' },
  negativeCount: { label: 'Negative training count', group: 'training', unit: 'count' },
  auc: { label: 'Exported AUC', group: 'evaluation', unit: 'auc' },
  successRate: { label: 'Exported success rate', group: 'evaluation', unit: 'percentage' },
  totalGain: { label: 'Stored internal split gain', group: 'gain', unit: 'gain' },
  topGainShare: { label: 'Largest predictor gain share', group: 'gain', unit: 'percentage' },
  stumps: { label: 'Stump trees', group: 'structure', unit: 'count' },
  missingChecks: { label: 'Explicit missing checks', group: 'structure', unit: 'count' },
} as const;
export type EvolutionMetric = keyof typeof EVOLUTION_METRICS;
export interface EvolutionSummary {
  exportTag: string;
  exportedAt?: string;
  digest?: string;
  metrics: Record<EvolutionMetric, number | null>;
  predictors: string[];
  audit?: {
    predictors: Array<Pick<AuditPredictor, 'feature' | 'gainShare' | 'splitCount' | 'minimumThreshold' | 'maximumThreshold' | 'thresholdBins' | 'numericSplits' | 'membershipSplits' | 'observedCategories' | 'categoryDigest'>>;
    namespaces: ModelAudit['namespaces'];
  };
}
export interface EvolutionSnapshot extends EvolutionSummary {
  id: string;
  name: string;
  time?: string;
  timeSource: 'export' | 'manual' | 'missing';
}

export function summarizeEvolution(result: ImportResult, analysis: ModelAnalysis): EvolutionSummary {
  const model = result.model;
  if (!model) throw new Error('A validated model is required for an evolution snapshot.');
  return {
    exportTag: model.modelVersion, exportedAt: model.factoryUpdateTime,
    metrics: {
      trees: model.trees.length, nodes: result.nodeCount,
      leaves: analysis.treeFacts.reduce((total, tree) => total + tree.leaves, 0),
      depth: result.maxDepth + 1, predictors: analysis.predictors.length,
      totalCount: model.trainingStats?.totalCount ?? null,
      positiveCount: model.trainingStats?.positiveCount ?? null,
      negativeCount: model.trainingStats?.negativeCount ?? null,
      auc: model.auc ?? null, successRate: model.successRate ?? null,
      totalGain: analysis.modelEvidence?.gain.totalInternalGain ?? null,
      topGainShare: analysis.modelEvidence?.gain.topPredictorGainShare ?? null,
      stumps: analysis.modelEvidence?.structure.stumpTrees ?? null,
      missingChecks: analysis.modelEvidence?.structure.missingChecks ?? null,
    },
    predictors: analysis.predictors.map(predictor => predictor.feature).sort(),
    audit: analysis.audit ? {
      predictors: analysis.audit.predictors.map(({ feature, gainShare, splitCount, minimumThreshold, maximumThreshold, thresholdBins, numericSplits, membershipSplits, observedCategories, categoryDigest }) => ({ feature, gainShare, splitCount, minimumThreshold, maximumThreshold, thresholdBins, numericSplits, membershipSplits, observedCategories, categoryDigest })),
      namespaces: analysis.audit.namespaces,
    } : undefined,
  };
}

export function parseManualSnapshotTime(input: string): string | undefined {
  const match = input.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!match) return undefined;
  const normalized = `${match[1]}:${match[2] ?? '00'}.${(match[3] ?? '').padEnd(3, '0')}Z`;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === normalized ? normalized : undefined;
}

export function orderSnapshots(snapshots: EvolutionSnapshot[]) {
  const dated: EvolutionSnapshot[] = [], undated: EvolutionSnapshot[] = [];
  const counts = new Map<string, number>();
  for (const snapshot of snapshots) {
    if (snapshot.time && parseManualSnapshotTime(snapshot.time.slice(0, -1)) === snapshot.time) {
      dated.push(snapshot); counts.set(snapshot.time, (counts.get(snapshot.time) ?? 0) + 1);
    } else undated.push(snapshot);
  }
  dated.sort((a, b) => a.time!.localeCompare(b.time!) || a.id.localeCompare(b.id));
  return { dated, undated, duplicateTimes: [...counts].filter(([, count]) => count > 1).map(([time]) => time) };
}

export function metricSegments(snapshots: EvolutionSnapshot[], metric: EvolutionMetric) {
  const segments: Array<Array<{ snapshot: EvolutionSnapshot; value: number }>> = [];
  let current: Array<{ snapshot: EvolutionSnapshot; value: number }> | undefined;
  for (const snapshot of snapshots) {
    const value = snapshot.metrics[metric];
    if (value === null) { current = undefined; continue; }
    if (!current) { current = []; segments.push(current); }
    current.push({ snapshot, value });
  }
  return segments;
}

export function compareSnapshots(before: EvolutionSnapshot, after: EvolutionSnapshot) {
  const earlier = new Set(before.predictors), later = new Set(after.predictors);
  const beforeAudit = new Map(before.audit?.predictors.map(row => [row.feature, row]));
  const ranks = (snapshot: EvolutionSnapshot) => {
    let previous: number | null = null, rank = 0;
    return new Map((snapshot.audit?.predictors ?? []).filter(row => row.gainShare !== null).sort((a, b) => b.gainShare! - a.gainShare! || a.feature.localeCompare(b.feature)).map((row, index) => {
      if (row.gainShare !== previous) rank = index + 1;
      previous = row.gainShare;
      return [row.feature, rank];
    }));
  };
  const beforeRanks = ranks(before), afterRanks = ranks(after);
  const common = (after.audit?.predictors ?? []).flatMap(row => {
    const previous = beforeAudit.get(row.feature);
    return previous ? [{ before: previous, after: row }] : [];
  });
  const oldNamespaces = new Map(before.audit?.namespaces.map(row => [row.namespace, row.gainShare]));
  const newNamespaces = new Map(after.audit?.namespaces.map(row => [row.namespace, row.gainShare]));
  const gainAvailable = before.metrics.totalGain !== null && before.metrics.totalGain > 0 && after.metrics.totalGain !== null && after.metrics.totalGain > 0;
  return {
    added: after.predictors.filter(name => !earlier.has(name)).sort(),
    removed: before.predictors.filter(name => !later.has(name)).sort(),
    auditAvailable: !!before.audit && !!after.audit,
    gainMovers: common.map(row => ({
      feature: row.after.feature, before: row.before.gainShare, after: row.after.gainShare,
      delta: row.before.gainShare === null || row.after.gainShare === null ? null : row.after.gainShare - row.before.gainShare,
      rankBefore: beforeRanks.get(row.after.feature) ?? null, rankAfter: afterRanks.get(row.after.feature) ?? null,
    })).sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0) || a.feature.localeCompare(b.feature)),
    namespaceChanges: [...new Set([...oldNamespaces.keys(), ...newNamespaces.keys()])].sort().map(namespace => {
      const previous = oldNamespaces.get(namespace) ?? (gainAvailable ? 0 : null), next = newNamespaces.get(namespace) ?? (gainAvailable ? 0 : null);
      return { namespace, before: previous, after: next, delta: previous === null || next === null ? null : next - previous };
    }),
    thresholdChanges: common.filter(row => (row.before.numericSplits || row.after.numericSplits) && JSON.stringify(row.before.thresholdBins) !== JSON.stringify(row.after.thresholdBins)),
    membershipChanges: common.filter(row => (row.before.membershipSplits || row.after.membershipSplits) && (row.before.categoryDigest === null || row.after.categoryDigest === null || row.before.categoryDigest !== row.after.categoryDigest || row.before.membershipSplits !== row.after.membershipSplits)),
    changes: (Object.keys(EVOLUTION_METRICS) as EvolutionMetric[]).map(metric => ({
      metric, before: before.metrics[metric], after: after.metrics[metric],
      delta: before.metrics[metric] === null || after.metrics[metric] === null ? null : after.metrics[metric] - before.metrics[metric],
    })),
  };
}

export function formatEvolutionValue(metric: EvolutionMetric, value: number | null): string {
  if (value === null) return 'Not available';
  const unit = EVOLUTION_METRICS[metric].unit;
  if (unit === 'percentage') return `${(value * 100).toFixed(2)}%`;
  if (unit === 'auc') return value.toFixed(4);
  if (unit === 'gain') return formatAuditNumber(value);
  return value.toLocaleString();
}
