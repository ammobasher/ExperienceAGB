import type { TreeNode } from './agb';
import { parseSplit } from './split';

export type PredictorOccurrence = {
  feature: string;
  treeIndex: number;
  nodeId: string;
  split: string;
};

export function indexPredictorOccurrences(trees: TreeNode[]): PredictorOccurrence[] {
  const occurrences: PredictorOccurrence[] = [];

  trees.forEach((tree, treeIndex) => {
    const pending: Array<{ node: TreeNode; nodeId: string }> = [{ node: tree, nodeId: 'root' }];
    while (pending.length) {
      const current = pending.pop();
      if (!current) continue;
      if (current.node.split) {
        occurrences.push({
          feature: (current.node.condition ?? parseSplit(current.node.split)).feature,
          treeIndex,
          nodeId: current.nodeId,
          split: current.node.split,
        });
      }
      if (current.node.right) pending.push({ node: current.node.right, nodeId: `${current.nodeId}.R` });
      if (current.node.left) pending.push({ node: current.node.left, nodeId: `${current.nodeId}.L` });
    }
  });

  const collator = new Intl.Collator(undefined, { numeric: true });
  return occurrences.sort((left, right) =>
    left.feature.localeCompare(right.feature)
    || left.treeIndex - right.treeIndex
    || collator.compare(left.nodeId, right.nodeId),
  );
}
