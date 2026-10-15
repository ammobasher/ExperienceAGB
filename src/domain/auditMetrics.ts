import type { ModelEvidence } from './modelEvidence';

export interface AuditMetric {
  id: string; label: string; value: number | null; unit: string;
  provenance: 'exported' | 'computed'; method: string; operands: Record<string, number | null>;
  validity: 'available' | 'unavailable'; reason: string | null; limitation: string;
}
export function auditMetrics(evidence: ModelEvidence): AuditMetric[] {
  const { coverage: c, monitoring: m, structure: s, gain: g } = evidence;
  const metric = (id: string, label: string, value: number | null, unit: string, provenance: AuditMetric['provenance'], method: string, operands: AuditMetric['operands'], limitation: string, reason = 'Required source data is absent, invalid or nonfinite.'): AuditMetric => ({
    id, label, value, unit, provenance, method, operands, validity: value === null ? 'unavailable' : 'available', reason: value === null ? reason : null, limitation,
  });
  const structural = 'Describes the complete accepted export, not predictive quality or Pega scoring parity.';
  const gainLimit = 'Sum of stored nonnegative internal-node gains, not SHAP, causal effect or business lift. Missing leaf gains do not block this metric.';
  return [
    metric('coverage.trees', 'Trees in ensemble', c.trees, 'trees', 'computed', 'Count accepted tree roots.', { trees: c.trees }, structural),
    metric('coverage.nodes', 'Nodes across all trees', c.nodes, 'nodes', 'computed', 'Count internal nodes and leaves.', { internalNodes: c.internalNodes, leaves: c.leaves }, structural),
    metric('coverage.leaves', 'Leaves across all trees', c.leaves, 'leaves', 'computed', 'Count nodes without splits.', { leaves: c.leaves }, structural),
    metric('structure.maximumDepthEdges', 'Deepest path', s.maximumDepthEdges, 'edges (root = 0)', 'computed', 'Maximum root-to-node edge count.', { maximumDepthEdges: s.maximumDepthEdges }, 'The tree explorer displays levels: edges plus one.'),
    metric('structure.stumpTrees', 'Stump trees', s.stumpTrees, 'trees', 'computed', 'Count roots without a split.', { stumpTrees: s.stumpTrees, trees: c.trees }, 'Stumps can be platform-baseline traits; this is not a defect verdict.'),
    metric('structure.missingChecks', 'Explicit missing checks', s.missingChecks, 'splits', 'computed', 'Count parsed is Missing operators.', { missingChecks: s.missingChecks, internalNodes: c.internalNodes }, 'Does not establish the rate of missing values in customer data.'),
    metric('monitoring.totalCount', 'Exported training count', m.totalCount, 'responses (export counter)', 'exported', 'Read trainingStats.totalCount.', { totalCount: m.totalCount }, 'Not unique customers or an independently verified response stream.'),
    metric('monitoring.pooledAUC', 'Exported pooled AUC', m.pooledAUC, 'AUC (0–1)', 'exported', 'Read exported auc; no per-action reconstruction.', { pooledAUC: m.pooledAUC }, 'Not a calibration measure, a weighted per-action AUC or a new performance test.'),
    metric('monitoring.exportedSuccessRate', 'Exported success rate', m.exportedSuccessRate, 'proportion (0–1)', 'exported', 'Read exported successRate.', { exportedSuccessRate: m.exportedSuccessRate }, 'Population and evaluation window are not reconstructed.'),
    metric('monitoring.baseSuccessRate', 'Training positive fraction', m.baseSuccessRate, 'proportion (0–1)', 'computed', 'positiveCount / totalCount, only when totalCount > 0.', { positiveCount: m.positiveCount, totalCount: m.totalCount }, 'Not a customer-level probability or calibration certificate.', 'Training counts are absent or the total is zero.'),
    metric('gain.totalInternalGain', 'Stored internal split gain', g.totalInternalGain, 'stored gain units', 'computed', 'Sum every nonnegative internal-node gain; require complete internal gain coverage.', { internalNodes: c.internalNodes, missingInternalGains: g.missingInternalGains, negativeInternalGains: g.negativeInternalGains }, gainLimit),
    metric('gain.topPredictorGainShare', 'Largest predictor gain share', g.topPredictorGainShare, 'proportion of total internal gain', 'computed', 'Largest predictor gain / total internal gain; require positive complete total.', { totalInternalGain: g.totalInternalGain, topPredictorGainShare: g.topPredictorGainShare }, gainLimit),
    metric('gain.meanGainFirstHalf', 'Mean total tree gain — first half', g.meanGainFirstHalf, 'stored gain units per tree', 'computed', 'Mean total internal gain per tree in first ceil(treeCount / 2) export positions.', { treesInWindow: Math.ceil(c.trees / 2), meanGainFirstHalf: g.meanGainFirstHalf }, 'Export order is not verified chronological age. This is not mean gain per split.'),
    metric('gain.meanGainLastHalf', 'Mean total tree gain — remaining half', g.meanGainLastHalf, 'stored gain units per tree', 'computed', 'Mean total internal gain per tree in remaining export positions.', { treesInWindow: Math.floor(c.trees / 2), meanGainLastHalf: g.meanGainLastHalf }, 'No remaining trees means unavailable, not zero.'),
  ];
}
