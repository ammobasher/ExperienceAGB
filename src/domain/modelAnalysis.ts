import type { AGBModel } from './agb';
import { buildProfileFeatures } from './profileTrace';
import type { ProfileFeature } from './profileTrace';
import { indexPredictorOccurrences } from './predictorSearch';
import type { PredictorOccurrence } from './predictorSearch';

export const OCCURRENCE_PAGE_SIZE = 20;
export interface TreeFacts {
  nodeCount: number;
  leaves: number;
  minimum: number;
  maximum: number;
  predictors: string[];
}
export interface PredictorGroup {
  feature: string;
  count: number;
  initialOccurrences: PredictorOccurrence[];
}
export interface ModelAnalysis {
  features: ProfileFeature[];
  treeFacts: TreeFacts[];
  predictors: PredictorGroup[];
  timings?: { parseMs: number; analysisMs: number };
}
export function analyseModel(model: AGBModel): { summary: ModelAnalysis; occurrences: Map<string, PredictorOccurrence[]> } {
  const occurrences = new Map<string, PredictorOccurrence[]>();
  for (const occurrence of indexPredictorOccurrences(model.trees)) {
    const group = occurrences.get(occurrence.feature) ?? [];
    group.push(occurrence);
    occurrences.set(occurrence.feature, group);
  }
  const treeFacts = model.trees.map(tree => {
    const predictors = new Set<string>();
    const facts: TreeFacts = { nodeCount: 0, leaves: 0, minimum: Infinity, maximum: -Infinity, predictors: [] };
    const pending = [tree];
    while (pending.length) {
      const node = pending.pop()!;
      facts.nodeCount += 1;
      if (node.condition) predictors.add(node.condition.feature);
      if (!node.split) {
        facts.leaves += 1;
        facts.minimum = Math.min(facts.minimum, node.score);
        facts.maximum = Math.max(facts.maximum, node.score);
      }
      if (node.right) pending.push(node.right);
      if (node.left) pending.push(node.left);
    }
    facts.predictors = [...predictors];
    return facts;
  });
  return {
    summary: {
      features: buildProfileFeatures(model.trees), treeFacts,
      predictors: [...occurrences].map(([feature, entries]) => ({
        feature, count: entries.length, initialOccurrences: entries.slice(0, OCCURRENCE_PAGE_SIZE),
      })),
    },
    occurrences,
  };
}
