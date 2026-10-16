import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { EnsembleTrace } from '../domain/profileTrace';
import { MAPPING_SCHEMA } from '../domain/propensityMapping';
import PropensityMappingPanel from './PropensityMappingPanel';

const binding = { sourceSha256: 'a'.repeat(64), exportTag: '2', exportUpdateTime: null };
const trace: EnsembleTrace = { complete: true, rawScore: .2, propensity: .549833997312478, stages: [], runningScores: [] };
function companion() {
  return {
    schema: MAPPING_SCHEMA, ...binding, inputDomain: 'raw-score', method: 'exported-values',
    context: { modelId: 'demo-model', action: 'Example action', channel: 'Web', direction: 'Inbound' },
    provenance: { reference: 'Synthetic example', platformVersion: 'test', capturedAt: '2024-01-01T00:00:00.000Z' },
    bins: [{ lower: -1, upper: 0, propensity: .1 }, { lower: 0, upper: 1, propensity: .1234567890123, positives: 28, negatives: 370 }],
  };
}
function upload(value: unknown = companion(), text?: () => Promise<string>) {
  const content = JSON.stringify(value), file = new File([content], 'companion.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: text ?? (async () => content) });
  fireEvent.change(screen.getByLabelText('Companion mapping JSON'), { target: { files: [file] } });
}
function confirm() { fireEvent.click(screen.getByRole('checkbox', { name: /I confirm this mapping/ })); }
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:template'), revokeObjectURL: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('withholds a mapping until explicitly confirmed, updates on profile edits and preserves exact evidence', async () => {
  const { rerender } = render(<PropensityMappingPanel binding={binding} trace={trace} />);
  expect(screen.getByText(/Classifier mapping required/)).toBeVisible();
  fireEvent.click(screen.getByText('Import or prepare a companion mapping'));
  upload();
  await screen.findByText('Companion loaded locally. Review its context and confirm before applying it.');
  expect(screen.queryByText('12.35%')).not.toBeInTheDocument();
  confirm();
  expect(screen.getByText('12.35%')).toBeVisible();
  expect(screen.getByRole('table')).toHaveTextContent('0.1234567890123');
  expect(screen.getByText(/28 positive \/ 370 negative/)).toBeVisible();
  rerender(<PropensityMappingPanel binding={binding} trace={{ ...trace, rawScore: -.3 }} />);
  expect(screen.getByText('10%')).toBeVisible();
  rerender(<PropensityMappingPanel binding={binding} trace={{ ...trace, rawScore: 2 }} />);
  expect(screen.getByText(/outside the supplied intervals/)).toBeVisible();
  expect(screen.queryByText('12.35%')).not.toBeInTheDocument();
  rerender(<PropensityMappingPanel binding={binding} trace={{ ...trace, complete: false }} />);
  expect(screen.getByText(/complete, finite ensemble route/)).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

it('preserves a previous mapping on rejection but requires reconfirmation, and clears it explicitly', async () => {
  render(<PropensityMappingPanel binding={binding} trace={trace} />);
  fireEvent.click(screen.getByText('Import or prepare a companion mapping'));
  upload(); await screen.findByText(/Companion loaded locally/); confirm();
  upload({ ...companion(), sourceSha256: 'b'.repeat(64) });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('does not match'));
  expect(screen.getByRole('checkbox', { name: /I confirm this mapping/ })).not.toBeChecked();
  expect(screen.queryByText('12.35%')).not.toBeInTheDocument();
  confirm(); expect(screen.getByText('12.35%')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Clear mapping' }));
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByText(/Classifier mapping required/)).toBeVisible();
});

it('ignores cancelled reads and clears model-bound state when a different file is opened', async () => {
  const { rerender } = render(<PropensityMappingPanel binding={binding} trace={trace} />);
  fireEvent.click(screen.getByText('Import or prepare a companion mapping'));
  let finish!: (text: string) => void;
  upload(companion(), () => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel mapping import' }));
  finish(JSON.stringify(companion()));
  await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
  upload(); await screen.findByText(/Companion loaded locally/); confirm();
  rerender(<PropensityMappingPanel binding={{ ...binding, sourceSha256: 'b'.repeat(64) }} trace={trace} />);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByText(/Classifier mapping required/)).toBeVisible();
});

it('bounds files before reading, surfaces read failures, and disables import without a model hash', async () => {
  const { rerender } = render(<PropensityMappingPanel binding={binding} trace={trace} />);
  fireEvent.click(screen.getByText('Import or prepare a companion mapping'));
  const read = vi.fn(), file = new File(['x'], 'big.json');
  Object.defineProperty(file, 'size', { value: 262145 }); Object.defineProperty(file, 'text', { value: read });
  fireEvent.change(screen.getByLabelText('Companion mapping JSON'), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('256 KiB'));
  expect(read).not.toHaveBeenCalled();
  upload(companion(), async () => { throw new Error('local failure'); });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not be read'));
  rerender(<PropensityMappingPanel binding={{ ...binding, sourceSha256: undefined }} trace={trace} />);
  expect(screen.getByRole('button', { name: 'Import companion mapping' })).toBeDisabled();
});

it('requires sensitive-template approval and revokes prepared URLs when cleared or unmounted', () => {
  const { unmount } = render(<PropensityMappingPanel binding={binding} trace={trace} />);
  fireEvent.click(screen.getByText('Import or prepare a companion mapping'));
  fireEvent.click(screen.getByText('Model fingerprint and empty template'));
  expect(screen.getByRole('button', { name: 'Prepare empty companion template' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /I approve preparing/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Prepare empty companion template' }));
  expect(screen.getByRole('link', { name: 'Save empty companion template' })).toHaveAttribute('href', 'blob:template');
  expect(screen.getByRole('checkbox', { name: /I approve preparing/ })).not.toBeChecked();
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:template');
});
