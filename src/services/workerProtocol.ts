import type { AGBModel, ImportResult, TreeNode } from '../domain/agb';
import type { ModelAnalysis } from '../domain/modelAnalysis';
import type { PredictorOccurrence } from '../domain/predictorSearch';
import type { EvolutionSummary } from '../domain/modelEvolution';
import type { AuditExportFormat } from '../domain/auditExport';

export interface WireNode {
  node: Omit<TreeNode, 'left' | 'right'>;
  parent: number | null;
  side?: 'left' | 'right';
  treeIndex: number;
}
export type WorkerRequest =
  | { kind: 'import'; file: Blob }
  | { kind: 'evolution-import'; file: Blob }
  | { kind: 'audit-export'; requestId: number; format: AuditExportFormat }
  | { kind: 'next-chunk' }
  | { kind: 'occurrences'; requestId: number; feature: string; offset: number };
export type WorkerReply =
  | { kind: 'progress'; message: string }
  | { kind: 'invalid'; result: ImportResult }
  | { kind: 'metadata'; model: Omit<AGBModel, 'trees'>; diagnostics: Omit<ImportResult, 'model'>; analysis: ModelAnalysis }
  | { kind: 'nodes'; entries: WireNode[] }
  | { kind: 'complete' }
  | { kind: 'evolution-summary'; summary: EvolutionSummary; issues: ImportResult['issues'] }
  | { kind: 'audit-export'; requestId: number; file: Blob }
  | { kind: 'audit-export-error'; requestId: number; message: string }
  | { kind: 'occurrences'; requestId: number; entries: PredictorOccurrence[] }
  | { kind: 'failure'; message: string };
export interface ImportedWorkspace {
  result: ImportResult;
  analysis?: ModelAnalysis;
}
export interface EvolutionImportResult { summary?: EvolutionSummary; issues: ImportResult['issues'] }
