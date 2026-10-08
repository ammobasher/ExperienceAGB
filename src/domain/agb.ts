import type { ParsedSplit } from './split';

export interface TreeNode {
  score: number;
  gain?: number;
  sampleCount: number;
  split?: string;
  left?: TreeNode;
  right?: TreeNode;
  condition?: ParsedSplit;
}

export interface AGBModel {
  modelVersion: string;
  factoryUpdateTime?: string;
  trainingStats?: {
    positiveCount: number;
    negativeCount: number;
    totalCount: number;
  };
  successRate?: number;
  auc?: number;
  trees: TreeNode[];
  scoringStatus: 'unverified-preview';
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface ImportResult {
  model: AGBModel | null;
  issues: ValidationIssue[];
  nodeCount: number;
  maxDepth: number;
}