import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./services/ModelWorkerClient', async () => {
  const { parseAGBText } = await import('./domain/importModel');
  const { analyseModel } = await import('./domain/modelAnalysis');
  return {
    ModelWorkerClient: class {
      async load(blob: Blob) {
        const text = 'text' in blob && typeof blob.text === 'function' ? await blob.text() : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('File read failed'));
          reader.readAsText(blob);
        });
        const result = parseAGBText(text, blob.size);
        return { result, analysis: result.model ? analyseModel(result.model).summary : undefined };
      }
      dispose() {}
      async getOccurrences() { return []; }
    },
  };
});

const model = {
  type: 'AdaptiveBoostScoringModel',
  modelVersion: '2',
  algorithm: 'GRADIENT_BOOST',
  model: {
    booster: {
      trees: [
        {
          score: 0,
          sampleCount: 20,
          split: 'Customer.Age < 35',
          left: { score: -0.1, sampleCount: 8 },
          right: { score: 0.2, sampleCount: 12 },
        },
        {
          score: 0,
          sampleCount: 20,
          split: 'Param.Channel in [Web]',
          left: { score: 0.1, sampleCount: 12 },
          right: { score: -0.1, sampleCount: 8 },
        },
      ],
    },
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('model workspace integration', () => {
  it('exposes one accessible file-picker control', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /Browse files/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('announces an actionable error when the selected file is not JSON', async () => {
    render(<App />);
    const dropTarget = screen.getByRole('heading', { name: 'Choose an export file' }).closest('.drop-target');

    expect(dropTarget).not.toBeNull();
    fireEvent.drop(dropTarget!, { dataTransfer: { files: [new File(['not a model'], 'notes.txt', { type: 'text/plain' })] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a Pega AGB export with a .json extension.');
  });

  it('shows the parser diagnostic for malformed JSON files', async () => {
    render(<App />);
    const dropTarget = screen.getByRole('heading', { name: 'Choose an export file' }).closest('.drop-target');
    const file = new File(['{'], 'broken.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => '{' });

    expect(dropTarget).not.toBeNull();
    fireEvent.drop(dropTarget!, { dataTransfer: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('$: This file is not valid JSON.');
  });

  it('loads a model, displays propensity, and navigates from predictor search to a split', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(model),
    }));
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Try the bundled sample/ }));
    expect(await screen.findByRole('heading', { name: 'Tree 1' })).toBeInTheDocument();
    expect(screen.getByText('57.44%')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search predictors' }), 'Param.Channel');
    const predictorSidebar = screen.getByRole('complementary', { name: 'Ensemble and predictor search' });
    await user.click(within(predictorSidebar).getByText('Param.Channel'));
    await user.click(screen.getByRole('button', { name: /Tree 2, root, Param.Channel in/ }));

    expect(screen.getByRole('heading', { name: 'Tree 2' })).toBeInTheDocument();
    const details = screen.getByRole('region', { name: 'Selected node details' });
    expect(within(details).getByText('Param.Channel in [Web]')).toBeInTheDocument();
    expect(within(details).getByText('Root')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Trace a profile' }));
    await user.click(screen.getByText(/Edit illustrative profile/));
    await user.clear(screen.getByRole('textbox', { name: 'Illustrative Customer.Age' }));
    expect(screen.getAllByText('Incomplete routes')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Inspect incomplete Tree 1: Customer.Age/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Inspect incomplete Tree 1: Customer.Age/ }));
    expect(screen.getByRole('heading', { name: 'Tree 1' })).toBeInTheDocument();
  }, 20000);

  it('filters trees by number and predictor and exposes supported metadata', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ ...model, factoryUpdateTime: '20240101T120000.000Z', trainingStats: { positiveCount: 8, negativeCount: 12, totalCount: 20 } }) }));
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Try the bundled sample/ }));
    expect(await screen.findByText('2024-01-01T12:00:00.000Z')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search trees' }), 'Channel');
    expect(screen.queryByRole('button', { name: /01 Tree 1/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /02 Tree 2/ })).toBeInTheDocument();
  });

  it('preserves an observed UUID export tag and accurately labels its adapter provenance', async () => {
    const user = userEvent.setup();
    const modelVersion = '11111111-2222-4333-8444-555555555555';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ ...model, modelVersion }) }));
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Try the bundled sample/ }));
    expect(await screen.findByText(`Export tag: ${modelVersion}`)).toBeInTheDocument();
    expect(screen.getByText(/Observed UUID-v4-tagged export structure/)).toBeInTheDocument();
    expect(screen.getByText(/Pega oracle and live-CDH scoring parity are not established/)).toBeInTheDocument();
    expect(screen.queryByText(/SAMPLE-V2 STRUCTURE VALIDATED/)).not.toBeInTheDocument();
  });
});
