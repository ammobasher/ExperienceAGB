import type { TreeNode } from './agb';
import { parseSplit } from './split';

export function explainNode(node: TreeNode): { question: string; description: string } {
  if (!node.split) {
    const score = `${node.score >= 0 ? '+' : ''}${node.score.toFixed(4)}`;
    return { question: 'Leaf contribution', description: `For a profile reaching this leaf, it contributes ${score} to the raw ensemble score. This is not a probability or a causal effect.` };
  }
  const split = node.condition ?? parseSplit(node.split);
  let question = `Can this condition be interpreted: ${split.feature}?`;
  if (split.operator === 'lt') question = `Is ${split.feature} less than ${split.threshold}?`;
  if (split.operator === 'missing') question = `Is ${split.feature} missing?`;
  if (split.operator === 'in') {
    const categories = split.categories ?? [];
    question = `Is ${split.feature} one of ${categories.slice(0, 5).map(value => JSON.stringify(value)).join(', ')}${categories.length > 5 ? ` (${categories.length} exported categories in total)` : ''}?`;
  }
  return { question, description: 'Yes follows True / Left; no follows False / Right. A split chooses a branch, not a probability. Its internal score field is not added to the trace.' };
}
