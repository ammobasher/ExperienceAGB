import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TreeDiagram from './TreeDiagram';
import type { TreeNode } from '../domain/agb';

const tree: TreeNode = {
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

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('TreeDiagram', () => {
  it.each([
    ['IH.Web.Inbound.ClickCount < 3', '< 3'],
    ['Customer.MissingScore is Missing', 'is missing'],
    ['Customer.Origin in [Web, Store]', 'in a set of 2 values'],
  ])('uses the parsed operator for the visual label of %s', (split, label) => {
    const node: TreeNode = { score: 0, sampleCount: 2, split, left: { score: -.1, sampleCount: 1 }, right: { score: .1, sampleCount: 1 } };
    const { container } = render(<TreeDiagram tree={node} treeNumber={1} nodeCount={3} leafCount={2} />);
    expect(container.querySelector('[data-node-id="root"] .tree-node-second-line')).toHaveTextContent(label);
  });
  it('selects nodes and collapses or expands their descendants', async () => {
    const user = userEvent.setup();
    render(<TreeDiagram tree={tree} treeNumber={4} nodeCount={5} leafCount={3} />);

    expect(screen.getByRole('group', { name: /Tree 4, top-down diagram/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('5 of 5 nodes shown; 3 of 3 leaves shown');

    const leaf = screen.getByRole('button', { name: /Leaf node; serialized score -0\.2000; exported sampleCount 12/ });
    await user.click(leaf);
    const details = screen.getByRole('region', { name: 'Selected node details' });
    expect(within(details).getByText('LEAF NODE')).toBeInTheDocument();
    expect(within(details).getByText('12')).toBeInTheDocument();
    expect(within(details).getByText('Serialized score field')).toBeInTheDocument();
    expect(within(details).getByText('-0.2000')).toBeInTheDocument();

    const root = screen.getByRole('button', { name: /Split node Customer.Age < 35/ });
    await user.click(root);
    await user.click(screen.getByRole('button', { name: /Collapse descendants/ }));
    expect(screen.getByRole('status')).toHaveTextContent('1 of 5 nodes shown; 0 of 3 leaves shown');
    expect(screen.queryByRole('button', { name: /Leaf node; serialized score -0\.2000; exported sampleCount 12/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Expand descendants/ }));
    expect(screen.getByRole('status')).toHaveTextContent('5 of 5 nodes shown; 3 of 3 leaves shown');
  });

  it('selects the reached profile leaf when a traced path is supplied', async () => {
    render(<TreeDiagram tree={tree} treeNumber={4} nodeCount={5} leafCount={3} tracePath={['root', 'root.R', 'root.R.L']} />);
    const reachedLeaf = screen.getByRole('button', { name: /Leaf node; serialized score \+0\.2000/ });
    await waitFor(() => expect(reachedLeaf).toHaveAttribute('aria-pressed', 'true'));
    const details = screen.getByRole('region', { name: 'Selected node details' });
    expect(within(details).getByText('R / L')).toBeInTheDocument();
  });

  it('supports keyboard focus and Enter selection for tree nodes', async () => {
    const user = userEvent.setup();
    render(<TreeDiagram tree={tree} treeNumber={1} nodeCount={5} leafCount={3} />);
    const root = screen.getByRole('button', { name: /Split node Customer.Age < 35/ });
    const leftLeaf = screen.getByRole('button', { name: /Leaf node; serialized score -0\.2000/ });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fit tree' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reveal selected node' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Enter diagram fullscreen' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Root' })).toHaveFocus();
    await user.tab();
    expect(screen.getByText('Diagram counts and controls')).toHaveFocus();
    await user.tab();
    expect(root).toHaveFocus();
    await user.tab();
    expect(leftLeaf).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(leftLeaf).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('region', { name: 'Selected node details' })).getByText('L')).toBeInTheDocument();
  });

  it('shows explicit fullscreen unsupported and rejected errors without replacing the diagram', async () => {
    const user = userEvent.setup();
    const { container } = render(<TreeDiagram tree={tree} treeNumber={1} nodeCount={5} leafCount={3} />);
    const graph = container.querySelector('.tree-svg');
    await user.click(screen.getByRole('button', { name: 'Enter diagram fullscreen' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable in this browser/);
    const workspace = container.querySelector<HTMLElement>('.diagram-workspace')!;
    Object.defineProperty(workspace, 'requestFullscreen', { configurable: true, value: vi.fn().mockRejectedValue(new Error('Denied')) });
    await user.click(screen.getByRole('button', { name: 'Enter diagram fullscreen' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not change fullscreen/);
    expect(screen.getByRole('button', { name: 'Enter diagram fullscreen' })).toHaveFocus();
    expect(container.querySelector('.tree-svg')).toBe(graph);
    expect(screen.getByRole('status')).toHaveTextContent('5 of 5 nodes shown');
  });

  it('focuses a predictor occurrence and expands collapsed ancestors', async () => {
    const user = userEvent.setup();
    const view = render(<TreeDiagram tree={tree} treeNumber={1} nodeCount={5} leafCount={3} />);
    await user.click(screen.getByRole('button', { name: /Split node Customer.Age < 35/ }));
    await user.click(screen.getByRole('button', { name: /Collapse descendants/ }));
    expect(screen.getByRole('status')).toHaveTextContent('1 of 5 nodes shown; 0 of 3 leaves shown');

    view.rerender(<TreeDiagram tree={tree} treeNumber={1} nodeCount={5} leafCount={3} focusedNodeId="root.R" />);
    const target = screen.getByRole('button', { name: /Split node Param.Channel in/ });
    await waitFor(() => expect(target).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('status')).toHaveTextContent('5 of 5 nodes shown; 3 of 3 leaves shown');
    expect(within(screen.getByRole('region', { name: 'Selected node details' })).getByText('R')).toBeInTheDocument();
    expect(target).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Tree text outline' })).toBeInTheDocument();
    expect(screen.getAllByText(/True.*Left/).length).toBeGreaterThan(0);
  });

  it('renders all 511 nodes of a deep tree without a depth or node-count cutoff', async () => {
    function large(depth: number): TreeNode {
      return depth === 0 ? { score: 0, sampleCount: 1 } : {
        score: 0, sampleCount: 1, split: `Age < ${depth}`, left: large(depth - 1), right: large(depth - 1),
      };
    }
    const targetId = `root${'.R'.repeat(8)}`;
    const { container } = render(<TreeDiagram tree={large(8)} treeNumber={1} nodeCount={511} leafCount={256} focusedNodeId={targetId} focusRequest={1} />);
    expect(container.querySelector('.diagram-workspace')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.tree-node')).toHaveLength(0);
    await waitFor(() => expect(container.querySelectorAll('.tree-node')).toHaveLength(511), { timeout: 4000 });
    expect(container.querySelectorAll('.tree-node.is-leaf')).toHaveLength(256);
    const outline = container.querySelector('.tree-outline')!;
    expect(outline.querySelectorAll('button')).toHaveLength(511);
    const outlineBatches = outline.querySelectorAll('ol');
    expect(outlineBatches).toHaveLength(16);
    expect(outlineBatches[15]).toHaveAttribute('start', '481');
    expect(container.querySelector(`[data-node-id="${targetId}"]`)).toHaveFocus();
    const toolbar = within(container.querySelector<HTMLElement>('.diagram-toolbar')!);
    expect(toolbar.getByRole('status')).toHaveTextContent('511 of 511 nodes shown; 256 of 256 leaves shown');
    expect(toolbar.getByRole('button', { name: 'Fit tree' })).toBeInTheDocument();
    expect(toolbar.getByRole('button', { name: 'Reveal selected node' })).toBeInTheDocument();
  });

  it('honors a repeated occurrence navigation request after returning to root', async () => {
    const user = userEvent.setup();
    const view = render(<TreeDiagram tree={tree} treeNumber={1} nodeCount={5} leafCount={3} focusedNodeId="root.R" focusRequest={1} />);
    const target = screen.getByRole('button', { name: /Split node Param.Channel in/ });
    await waitFor(() => expect(target).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Root' }));
    expect(within(screen.getByRole('region', { name: 'Selected node details' })).getByText('Root')).toBeInTheDocument();
    view.rerender(<TreeDiagram tree={tree} treeNumber={1} nodeCount={5} leafCount={3} focusedNodeId="root.R" focusRequest={2} />);
    await waitFor(() => expect(target).toHaveFocus());
    expect(target).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the complete 33-node/17-leaf tree by default and only hides manually collapsed branches', async () => {
    const user = userEvent.setup();
    const leaf: TreeNode = { score: 0.1, sampleCount: 1 };
    const split = (left: TreeNode, right: TreeNode): TreeNode => ({ score: 0, sampleCount: left.sampleCount + right.sampleCount, split: 'Age < 1', left, right });
    const twoLeaves = () => split(leaf, leaf);
    const fourLeaves = () => split(twoLeaves(), twoLeaves());
    const input = split(split(leaf, split(fourLeaves(), leaf)), split(split(fourLeaves(), twoLeaves()), split(fourLeaves(), leaf)));
    const { container } = render(<TreeDiagram tree={input} treeNumber={1} nodeCount={33} leafCount={17} />);
    expect(container.querySelectorAll('.tree-node')).toHaveLength(33);
    expect(container.querySelectorAll('.tree-node.is-leaf')).toHaveLength(17);
    expect(screen.getByRole('status')).toHaveTextContent('33 of 33 nodes shown; 17 of 17 leaves shown');
    expect(screen.getByText(/All nodes and leaves are shown/)).toBeInTheDocument();
    await user.click(container.querySelector<SVGGElement>('[data-node-id="root.L.R.L"]')!);
    await user.click(screen.getByRole('button', { name: 'Collapse descendants' }));
    expect(screen.getByRole('status')).toHaveTextContent('27 of 33 nodes shown; 13 of 17 leaves shown');
    await user.click(container.querySelector<SVGGElement>('[data-node-id="root.L.R"]')!);
    await user.click(screen.getByRole('button', { name: 'Collapse descendants' }));
    expect(screen.getByRole('status')).toHaveTextContent('25 of 33 nodes shown; 12 of 17 leaves shown');
    await user.click(screen.getByRole('button', { name: 'Expand descendants' }));
    expect(screen.getByRole('status')).toHaveTextContent('33 of 33 nodes shown; 17 of 17 leaves shown');
    await user.click(container.querySelector<SVGGElement>('[data-node-id="root.L.R.L"]')!);
    await user.click(screen.getByRole('button', { name: 'Focus this subtree' }));
    expect(screen.getByRole('status')).toHaveTextContent('7 of 33 nodes shown; 4 of 17 leaves shown');
    expect(screen.getByText(/outside the focused subtree/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Root' }));
    expect(screen.getByRole('status')).toHaveTextContent('33 of 33 nodes shown; 17 of 17 leaves shown');
    await user.click(screen.getByRole('button', { name: 'Fit tree' }));
    expect(screen.getByRole('status')).toHaveTextContent('33 of 33 nodes shown; 17 of 17 leaves shown');
  });

  it('reveals deep trace and predictor targets without automatically narrowing the tree scope', async () => {
    let input: TreeNode = { score: 0.1, sampleCount: 1 };
    for (let depth = 0; depth < 6; depth++) input = { score: 0, sampleCount: 1, split: `Age < ${depth}`, left: { score: 0.1, sampleCount: 1 }, right: input };
    const targetId = `root${'.R'.repeat(6)}`;
    const view = render(<TreeDiagram tree={input} treeNumber={1} nodeCount={13} leafCount={7} tracePath={['root', targetId]} />);
    expect(screen.getByRole('status')).toHaveTextContent('13 of 13 nodes shown; 7 of 7 leaves shown');
    expect(screen.queryByRole('button', { name: 'Parent subtree' })).not.toBeInTheDocument();
    view.rerender(<TreeDiagram tree={input} treeNumber={1} nodeCount={13} leafCount={7} focusedNodeId={targetId} focusRequest={1} />);
    await waitFor(() => expect(view.container.querySelector(`[data-node-id="${targetId}"]`)).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent('13 of 13 nodes shown; 7 of 7 leaves shown');
    expect(screen.queryByRole('button', { name: 'Parent subtree' })).not.toBeInTheDocument();
  });
});