import type { EnsembleTrace } from './profileTrace';

export function changedTreeIndices(before: EnsembleTrace, after: EnsembleTrace): number[] {
  return after.stages.filter((stage, index) => {
    const previous = before.stages[index];
    return !previous || previous.complete !== stage.complete || previous.path.join('.') !== stage.path.join('.')
      || previous.leaf?.score !== stage.leaf?.score || previous.issue?.reason !== stage.issue?.reason;
  }).map(stage => stage.treeIndex);
}
