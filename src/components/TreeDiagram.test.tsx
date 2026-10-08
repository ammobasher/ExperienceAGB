import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
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

afterEach(() => cleanup());

describe('TreeDiagram', () => {
  it('selects nodes and collapses or expands their descendants', async () => {
    const user = userEvent.setup();
    render(<TreeDiagram tree={tree} treeNumber={4} />);

    expect(screen.getByRole('group', { name: /Tree 4, top-down diagram/ })).toBeInTheDocument();
    expect(screen.getByText('5 visible nodes')).toBeInTheDocument();

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
    expect(screen.getByText('1 visible nodes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Leaf node; serialized score -0\.2000; exported sampleCount 12/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Expand descendants/ }));
    expect(screen.getByText('5 visible nodes')).toBeInTheDocument();
  });

  it('selects the reached profile leaf when a traced path is supplied', async () => {
    render(<TreeDiagram tree={tree} treeNumber={4} tracePath={['root', 'root.R', 'root.R.L']} />);
    const reachedLeaf = screen.getByRole('button', { name: /Leaf node; serialized score \+0\.2000/ });
    await waitFor(() => expect(reachedLeaf).toHaveAttribute('aria-pressed', 'true'));
    const details = screen.getByRole('region', { name: 'Selected node details' });
    expect(within(details).getByText('R / L')).toBeInTheDocument();
  });

  it('supports keyboard focus and Enter selection for tree nodes', async () => {
    const user = userEvent.setup();
    render(<TreeDiagram tree={tree} treeNumber={1} />);
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
    expect(screen.getByRole('button', { name: 'Root' })).toHaveFocus();
    await user.tab();
    expect(root).toHaveFocus();
    await user.tab();
    expect(leftLeaf).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(leftLeaf).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('region', { name: 'Selected node details' })).getByText('L')).toBeInTheDocument();
  });

  it('focuses a predictor occurrence and expands collapsed ancestors', async () => {
    const user = userEvent.setup();
    const view = render(<TreeDiagram tree={tree} treeNumber={1} />);
    await user.click(screen.getByRole('button', { name: /Split node Customer.Age < 35/ }));
    await user.click(screen.getByRole('button', { name: /Collapse descendants/ }));
    expect(screen.getByText('1 visible nodes')).toBeInTheDocument();

    view.rerender(<TreeDiagram tree={tree} treeNumber={1} focusedNodeId="root.R" />);
    const target = screen.getByRole('button', { name: /Split node Param.Channel in/ });
    await waitFor(() => expect(target).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByText('5 visible nodes')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Selected node details' })).getByText('R')).toBeInTheDocument();
    expect(target).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Tree text outline' })).toBeInTheDocument();
    expect(screen.getAllByText(/True.*Left/).length).toBeGreaterThan(0);
  });

  it('bounds initially rendered deep trees and offers fit/selection controls', () => {
    function large(depth: number): TreeNode {
      return depth === 0 ? { score: 0, sampleCount: 1 } : {
        score: 0, sampleCount: 1, split: `Age < ${depth}`, left: large(depth - 1), right: large(depth - 1),
      };
    }
    const { container } = render(<TreeDiagram tree={large(9)} treeNumber={1} />);
    expect(container.querySelectorAll('.tree-node').length).toBeLessThanOrEqual(127);
    expect(screen.getByRole('button', { name: 'Fit tree' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reveal selected node' })).toBeInTheDocument();
  });

  it('honors a repeated occurrence navigation request after returning to root', async () => {
    const user = userEvent.setup();
    const view = render(<TreeDiagram tree={tree} treeNumber={1} focusedNodeId="root.R" focusRequest={1} />);
    const target = screen.getByRole('button', { name: /Split node Param.Channel in/ });
    await waitFor(() => expect(target).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Root' }));
    expect(within(screen.getByRole('region', { name: 'Selected node details' })).getByText('Root')).toBeInTheDocument();
    view.rerender(<TreeDiagram tree={tree} treeNumber={1} focusedNodeId="root.R" focusRequest={2} />);
    await waitFor(() => expect(target).toHaveFocus());
    expect(target).toHaveAttribute('aria-pressed', 'true');
  });
});