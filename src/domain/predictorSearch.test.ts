import { describe, expect, it } from 'vitest';
import { indexPredictorOccurrences } from './predictorSearch';
import type { TreeNode } from './agb';

const trees: TreeNode[] = [{
  score: 0,
  sampleCount: 10,
  split: 'Customer.Age < 35',
  left: { score: -0.1, sampleCount: 4 },
  right: {
    score: 0.1,
    sampleCount: 6,
    split: 'Param.Channel in [Web, Store]',
    left: { score: 0.2, sampleCount: 3 },
    right: { score: -0.2, sampleCount: 3 },
  },
}, {
  score: 0,
  sampleCount: 5,
  split: 'Customer.Age < 50',
  left: { score: 0.1, sampleCount: 2 },
  right: { score: -0.1, sampleCount: 3 },
}];

describe('predictor occurrence index', () => {
  it('indexes each split by parsed feature, tree and stable node path', () => {
    expect(indexPredictorOccurrences(trees)).toEqual([
      { feature: 'Customer.Age', treeIndex: 0, nodeId: 'root', split: 'Customer.Age < 35' },
      { feature: 'Customer.Age', treeIndex: 1, nodeId: 'root', split: 'Customer.Age < 50' },
      { feature: 'Param.Channel', treeIndex: 0, nodeId: 'root.R', split: 'Param.Channel in [Web, Store]' },
    ]);
  });
});
