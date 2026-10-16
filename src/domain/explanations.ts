import type { TreeNode } from './agb';
import { parseSplit } from './split';

export function explainNode(node: TreeNode): { question: string; description: string } {
  if (!node.split) {
    const score = `${node.score >= 0 ? '+' : ''}${node.score.toFixed(4)}`;
    return { question: 'Leaf contribution', description: `This leaf contributes ${score} to the combined raw score for a profile that reaches it. A positive contribution raises that score; a negative one lowers it. This is not a probability or a causal effect.` };
  }
  const split = node.condition ?? parseSplit(node.split);
  let question = `Can this condition be interpreted: ${split.feature}?`;
  if (split.operator === 'lt') question = `Is ${split.feature} less than ${split.threshold}?`;
  if (split.operator === 'missing') question = `Is ${split.feature} missing?`;
  if (split.operator === 'in') {
    const categories = split.categories ?? [];
    question = `Is ${split.feature} one of ${categories.slice(0, 5).map(value => JSON.stringify(value)).join(', ')}${categories.length > 5 ? ` (${categories.length} exported categories in total)` : ''}?`;
  }
  return { question, description: 'Answer yes to follow True / Left, or no to follow False / Right. This question only chooses the next branch; it does not return a probability. Only the leaf reached at the end adds a score.' };
}
