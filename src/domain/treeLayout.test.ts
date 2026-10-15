import { describe, expect, it } from 'vitest';
import { layoutTree } from './treeLayout';
import type { TreeNode } from './agb';

const sampleTree: TreeNode = {
  score: 0,
  sampleCount: 30,
  split: 'Customer.Age < 35',
  left: { score: -0.2, sampleCount: 12 },
  right: {
    score: 0.1,
    sampleCount: 18,
    split: 'Param.Channel in [Web, Store]',
    left: { score: 0.2, sampleCount: 8 },
    right: { score: -0.1, sampleCount: 10 },
  },
};

describe('layoutTree', () => {
  it('places parent nodes above their children and returns connecting links', () => {
    const layout = layoutTree(sampleTree);
    const root = layout.nodes.find((node) => node.id === 'root');
    const rightChild = layout.nodes.find((node) => node.id === 'root.R');
    expect(layout.nodes).toHaveLength(5);
    expect(layout.links).toHaveLength(4);
    expect(root?.y).toBeLessThan(rightChild?.y ?? 0);
    expect(layout.width).toBeGreaterThan(208);
  });

  it('collapses a selected split to its visible node', () => {
    const layout = layoutTree(sampleTree, new Set(['root.R']));
    const collapsed = layout.nodes.find((node) => node.id === 'root.R');
    expect(layout.nodes.map((node) => node.id)).toEqual(['root', 'root.L', 'root.R']);
    expect(collapsed).toMatchObject({ hasChildren: true, collapsed: true });
  });

  it('lays out every node beyond the former 127-node cutoff', () => {
    function fullTree(depth: number): TreeNode {
      return depth === 0 ? { score: 0, sampleCount: 1 } : { score: 0, sampleCount: 1, split: 'Age < 1', left: fullTree(depth - 1), right: fullTree(depth - 1) };
    }
    const layout = layoutTree(fullTree(9));
    expect(layout.nodes).toHaveLength(1023);
    expect(layout.links).toHaveLength(1022);
    expect(layout.nodes.filter(node => !node.hasChildren)).toHaveLength(512);
    expect(layout.nodes.some(node => node.collapsed)).toBe(false);
    expect(layout.nodes.some(node => node.id === `root${'.R'.repeat(9)}`)).toBe(true);
  });
});