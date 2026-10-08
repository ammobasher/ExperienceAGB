import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileTracePanel from './ProfileTracePanel';
import type { ProfileFeature, StageTrace } from '../domain/profileTrace';

const features: ProfileFeature[] = [{
  name: 'Customer.Age',
  kind: 'number',
  suggestedValue: '35',
  thresholds: [35],
  categories: [],
}];

const completeStage: StageTrace = {
  treeIndex: 0,
  complete: true,
  path: ['root', 'root.L'],
  leaf: { score: -0.12, sampleCount: 5 },
};

afterEach(() => cleanup());

function makeProps(stage = completeStage) {
  return {
    features,
    values: { 'Customer.Age': '35' },
    stage,
    runningScore: -0.12,
    ensembleComplete: true,
    ensembleRawScore: 0.12,
    ensemblePropensity: 1 / (1 + Math.exp(-0.12)),
    treeIndex: 0,
    treeCount: 3,
    search: '',
    onSearchChange: vi.fn(),
    onValueChange: vi.fn(),
    onTreeChange: vi.fn(),
    onRegenerate: vi.fn(),
    onReset: vi.fn(),
  };
}

describe('ProfileTracePanel', () => {
  it('does not mount a closed editor and paginates large feature lists', async () => {
    const props = makeProps();
    props.features = Array.from({ length: 60 }, (_, index) => ({ ...features[0], name: `Feature${index}` }));
    render(<ProfileTracePanel {...props} />);
    expect(screen.queryByRole('textbox', { hidden: true })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText(/Edit illustrative profile/));
    expect(screen.getAllByRole('textbox').length).toBeLessThanOrEqual(25);
    await userEvent.click(screen.getByRole('button', { name: 'Next features' }));
    expect(screen.getByRole('textbox', { name: 'Illustrative Feature25' })).toBeInTheDocument();
  });
  it('shows the reached leaf score and advances to the next tree', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<ProfileTracePanel {...props} />);

    expect(screen.getByText('ILLUSTRATIVE')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getAllByText('-0.1200')).toHaveLength(2);
    expect(screen.getByText('Running raw score through this tree')).toBeInTheDocument();
    expect(screen.getByText('53.00%')).toBeInTheDocument();
    expect(screen.queryByText('Final propensity')).not.toBeInTheDocument();
    expect(screen.getByText('Unverified propensity preview')).toBeInTheDocument();
    expect(screen.getByText(/Pega oracle parity has not been verified/)).toBeInTheDocument();
    expect(screen.getByText(/Each tree starts at its own root/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next tree/ }));
    expect(props.onTreeChange).toHaveBeenCalledWith(1);
  });

  it('surfaces incomplete routes and permits editing profile values', async () => {
    const user = userEvent.setup();
    const stage: StageTrace = {
      treeIndex: 0,
      complete: false,
      path: ['root'],
      issue: { feature: 'Customer.Age', reason: 'missing-value', message: 'Enter a value for Customer.Age; no branch was assumed.' },
    };
    const props = makeProps(stage);
    props.ensembleComplete = false;
    render(<ProfileTracePanel {...props} />);

    expect(screen.getByText('ROUTE INCOMPLETE')).toBeInTheDocument();
    expect(screen.getAllByText(/no branch was assumed/).length).toBeGreaterThan(0);
    await user.click(screen.getByText(/Edit illustrative profile/));
    await user.clear(screen.getByRole('searchbox', { name: 'Filter features' }));
    const input = screen.getByRole('textbox', { name: 'Illustrative Customer.Age' });
    fireEvent.change(input, { target: { value: '42' } });
    expect(props.onValueChange).toHaveBeenCalledWith('Customer.Age', '42');
  });

  it('refocuses the same blocked field on every explicit edit request', async () => {
    const stage: StageTrace = {
      treeIndex: 0, complete: false, path: ['root', 'root.R'], steps: [{ nodeId: 'root', question: 'Is Prior less than 1?', branch: 'False / Right', feature: 'Prior', value: '2' }],
      issue: { feature: 'Customer.Age', reason: 'missing-value', message: 'Enter a value.' },
    };
    const props = makeProps(stage);
    props.ensembleComplete = false;
    render(<ProfileTracePanel {...props} />);
    const button = screen.getByRole('button', { name: 'Edit blocked feature Customer.Age' });
    await userEvent.click(button);
    const input = screen.getByRole('textbox', { name: 'Illustrative Customer.Age' });
    expect(input).toHaveFocus();
    await userEvent.click(button);
    expect(input).toHaveFocus();
    expect(screen.getByText('Resolved route prefix')).toBeInTheDocument();
  });
});