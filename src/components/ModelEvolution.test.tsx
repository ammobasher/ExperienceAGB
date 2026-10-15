import { createHash } from 'node:crypto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModelEvolution from './ModelEvolution';
import { parseAGBText } from '../domain/importModel';
import { analyseModel } from '../domain/modelAnalysis';
import { summarizeEvolution } from '../domain/modelEvolution';
import type { EvolutionImportResult } from '../services/workerProtocol';

const { readEvolution, dispose } = vi.hoisted(() => ({
  readEvolution: vi.fn<(file: Blob, signal?: AbortSignal, onProgress?: (message: string) => void) => Promise<EvolutionImportResult>>(),
  dispose: vi.fn(),
}));
vi.mock('../services/ModelWorkerClient', () => ({
  ModelWorkerClient: class {
    readEvolution(file: Blob, signal?: AbortSignal, onProgress?: (message: string) => void) { return readEvolution(file, signal, onProgress); }
    dispose() { dispose(); }
  },
}));
const model = {
  type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST',
  model: { booster: { trees: [{ score: 0, sampleCount: 1 }] } },
};
function file(name: string, extra: Record<string, unknown> = {}, malformed?: string) {
  const text = malformed ?? JSON.stringify({ ...model, ...extra });
  const result = new File([text], name, { type: 'application/json' });
  Object.defineProperty(result, 'text', { value: async () => text });
  return result;
}
async function read(file: Blob): Promise<EvolutionImportResult> {
  const text = await file.text(), result = parseAGBText(text, file.size);
  return {
    summary: result.model ? { ...summarizeEvolution(result, analyseModel(result.model).summary), digest: createHash('sha256').update(text).digest('hex') } : undefined,
    issues: result.issues,
  };
}
function upload(files: File[]) {
  fireEvent.change(screen.getByLabelText('Snapshot export files'), { target: { files } });
}
beforeEach(() => { readEvolution.mockReset().mockImplementation(read); dispose.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ModelEvolution', () => {
  it('requires same-model confirmation, orders dates and skips exact duplicates while retaining valid files from a mixed batch', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<ModelEvolution />);
    expect(screen.getByRole('button', { name: 'Add snapshot files' })).toBeDisabled();
    upload([file('not-yet.json')]);
    expect(readEvolution).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    const early = file('early.json', { factoryUpdateTime: '2024-01-01T00:00:00.000Z', auc: 0, successRate: 0 });
    const late = file('late.json', { factoryUpdateTime: '2024-04-01T00:00:00.000Z' });
    upload([late, early, early, file('broken.json', {}, '{')]);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 added, 1 exact duplicates skipped, 1 rejected'));
    const membership = within(screen.getByRole('region', { name: 'Snapshot membership and dates' }));
    expect(membership.getAllByRole('row')[1]).toHaveTextContent('early.json');
    expect(membership.getAllByRole('row')[2]).toHaveTextContent('late.json');
    expect(screen.getByText(/Duplicate skipped: these exact file bytes/)).toBeInTheDocument();
    expect(screen.getByText(/Rejected: the export did not pass validation/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Evolution insights' })).toBeInTheDocument();
    const metrics = within(screen.getByRole('table', { name: 'Exact metrics for all retained snapshots' }));
    expect(within(metrics.getAllByRole('row')[1]).getAllByRole('cell')[8]).toHaveTextContent('0.0000Parsed export: 0');
    expect(within(metrics.getAllByRole('row')[1]).getAllByRole('cell')[9]).toHaveTextContent('0.00%Parsed export: 0');
    expect(metrics.getAllByRole('row')[2]).toHaveTextContent('Not available');
    expect(screen.getByRole('img', { name: /Exported AUC over UTC time; 1 of 2/ })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires valid dates, pauses ambiguous chronology, and supports explicit manual UTC time with provenance and clearing', async () => {
    render(<ModelEvolution />);
    fireEvent.click(screen.getByRole('checkbox'));
    upload([file('dated.json', { factoryUpdateTime: '2024-01-01T00:00:00.000Z' }), file('unknown.json')]);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 added'));
    expect(screen.queryByRole('region', { name: 'Evolution insights' })).not.toBeInTheDocument();
    const membership = screen.getByRole('region', { name: 'Snapshot membership and dates' });
    const row = within(membership).getByRole('row', { name: /unknown.json/ });
    const input = within(row).getByLabelText('UTC time for unknown.json');
    fireEvent.click(within(row).getByRole('button', { name: 'Apply UTC time' }));
    expect(within(row).getByRole('alert')).toHaveTextContent('Enter a valid UTC date and time');
    fireEvent.change(input, { target: { value: '2024-01-01T00:00' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Apply UTC time' }));
    expect(screen.getByRole('alert')).toHaveTextContent('same UTC time');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '2024-01-10T00:00' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Apply UTC time' }));
    expect(row).toHaveTextContent('(manual)');
    expect(screen.getByRole('region', { name: 'Evolution insights' })).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Clear manual time' }));
    expect(row).toHaveTextContent('Time not available (missing)');
    expect(screen.queryByRole('region', { name: 'Evolution insights' })).not.toBeInTheDocument();
    const datedRow = within(membership).getByRole('row', { name: /dated.json/ });
    fireEvent.change(within(datedRow).getByLabelText('UTC time for dated.json'), { target: { value: '2024-05-01T00:00' } });
    fireEvent.click(within(datedRow).getByRole('button', { name: 'Apply UTC time' }));
    expect(datedRow).toHaveTextContent('(manual)');
    fireEvent.click(within(datedRow).getByRole('button', { name: 'Restore export time' }));
    expect(datedRow).toHaveTextContent('2024-01-01T00:00:00.000Z (export)');
    fireEvent.click(screen.getByRole('button', { name: 'Clear comparison' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('cancels unfinished work without losing summaries already imported or processing the remaining files', async () => {
    readEvolution.mockImplementationOnce(read).mockImplementationOnce((_file, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    }));
    const view = render(<ModelEvolution />);
    fireEvent.click(screen.getByRole('checkbox'));
    upload([file('one.json'), file('two.json'), file('three.json')]);
    await waitFor(() => expect(readEvolution).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel snapshot import' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cancelled. Kept 1 newly imported snapshots'));
    expect(readEvolution).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('table', { name: 'Exact metrics for all retained snapshots' })).toHaveTextContent('one.json');
    expect(screen.getByRole('button', { name: 'Add snapshot files' })).toBeEnabled();
    view.unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it('allows explicitly retaining identical exports observed at different times without inventing a date', async () => {
    render(<ModelEvolution />);
    fireEvent.click(screen.getByRole('checkbox'));
    upload([file('unchanged-first.json'), file('unchanged-later.json')]);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 added, 1 exact duplicates skipped'));
    fireEvent.click(screen.getByRole('button', { name: 'Keep as separate snapshot' }));
    expect(screen.getByRole('status')).toHaveTextContent('Supply its actual UTC time');
    const metrics = screen.getByRole('table', { name: 'Exact metrics for all retained snapshots' });
    expect(within(metrics).getAllByRole('row')).toHaveLength(3);
    expect(metrics).toHaveTextContent('unchanged-later.jsonTime not available');
    expect(screen.queryByRole('region', { name: 'Evolution insights' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keep as separate snapshot' })).not.toBeInTheDocument();
  });

  it('paginates retained snapshots and clamps pages after removal rather than imposing a snapshot-count cutoff', async () => {
    render(<ModelEvolution />);
    fireEvent.click(screen.getByRole('checkbox'));
    upload(Array.from({ length: 12 }, (_, index) => file(`snapshot-${index + 1}.json`, { factoryUpdateTime: `2024-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('12 added'));
    const membership = within(screen.getByRole('region', { name: 'Snapshot membership and dates' }));
    expect(membership.getAllByRole('row')).toHaveLength(11);
    fireEvent.click(screen.getByRole('button', { name: 'Next snapshots' }));
    expect(membership.getAllByRole('row')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Remove snapshot-12.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove snapshot-11.json' }));
    expect(membership.getAllByRole('row')).toHaveLength(11);
    expect(screen.queryByRole('button', { name: 'Next snapshots' })).not.toBeInTheDocument();
    expect(screen.getByText(/10 snapshots retained/)).toBeInTheDocument();
  });
});
