import type { AGBModel, ImportResult, TreeNode } from '../domain/agb';
import type { ModelAnalysis } from '../domain/modelAnalysis';
import type { PredictorOccurrence } from '../domain/predictorSearch';

export interface WireNode {
  node: Omit<TreeNode, 'left' | 'right'>;
  parent: number | null;
  side?: 'left' | 'right';
  treeIndex: number;
}
export type WorkerRequest =
  | { kind: 'import'; file: Blob }
  | { kind: 'next-chunk' }
  | { kind: 'occurrences'; requestId: number; feature: string; offset: number };
export type WorkerReply =
  | { kind: 'progress'; message: string }
  | { kind: 'invalid'; result: ImportResult }
  | { kind: 'metadata'; model: Omit<AGBModel, 'trees'>; diagnostics: Omit<ImportResult, 'model'>; analysis: ModelAnalysis }
  | { kind: 'nodes'; entries: WireNode[] }
  | { kind: 'complete' }
  | { kind: 'occurrences'; requestId: number; entries: PredictorOccurrence[] }
  | { kind: 'failure'; message: string };
export interface ImportedWorkspace {
  result: ImportResult;
  analysis?: ModelAnalysis;
}
