import { hierarchy, tree as createTreeLayout } from 'd3-hierarchy';
import type { TreeNode } from './agb';

export const TREE_NODE_WIDTH = 208;
export const TREE_NODE_HEIGHT = 88;

export interface PositionedTreeNode {
  id: string;
  node: TreeNode;
  x: number;
  y: number;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
}

export interface PositionedTreeLink {
  id: string;
  source: PositionedTreeNode;
  target: PositionedTreeNode;
}

export interface TreeLayout {
  width: number;
  height: number;
  nodes: PositionedTreeNode[];
  links: PositionedTreeLink[];
}

interface BranchData {
  id: string;
  node: TreeNode;
}

export function layoutTree(rootNode: TreeNode, collapsedIds: ReadonlySet<string> = new Set(), rootId = 'root'): TreeLayout {
  const rootData: BranchData = { id: rootId, node: rootNode };
  const root = hierarchy(rootData, (branch) => {
    if (collapsedIds.has(branch.id)) return undefined;
    const children: BranchData[] = [];
    if (branch.node.left) children.push({ id: `${branch.id}.L`, node: branch.node.left });
    if (branch.node.right) children.push({ id: `${branch.id}.R`, node: branch.node.right });
    return children.length ? children : undefined;
  });
  const positionedRoot = createTreeLayout<BranchData>().nodeSize([248, 138])(root);
  const unshifted = positionedRoot.descendants();
  let minX = Infinity, maxX = -Infinity;
  for (const item of unshifted) {
    minX = Math.min(minX, item.x);
    maxX = Math.max(maxX, item.x);
  }
  const paddingX = 28;
  const paddingY = 26;
  const nodesById = new Map<string, PositionedTreeNode>();
  const nodes = unshifted.map((item): PositionedTreeNode => {
    const modelNode = item.data.node;
    const hasChildren = Boolean(modelNode.left || modelNode.right);
    const positioned: PositionedTreeNode = {
      id: item.data.id,
      node: modelNode,
      x: item.x - minX + paddingX + TREE_NODE_WIDTH / 2,
      y: item.y + paddingY + TREE_NODE_HEIGHT / 2,
      depth: item.depth,
      hasChildren,
      collapsed: hasChildren && !item.children?.length,
    };
    nodesById.set(positioned.id, positioned);
    return positioned;
  });
  const links = positionedRoot.links().map((link): PositionedTreeLink => ({
    id: `${link.source.data.id}-${link.target.data.id}`,
    source: nodesById.get(link.source.data.id)!,
    target: nodesById.get(link.target.data.id)!,
  }));

  return {
    width: maxX - minX + TREE_NODE_WIDTH + paddingX * 2,
    height: positionedRoot.height * 138 + TREE_NODE_HEIGHT + paddingY * 2,
    nodes,
    links,
  };
}