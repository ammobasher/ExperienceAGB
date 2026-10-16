import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import type { AGBModel } from '../domain/agb';
import { analyseModel } from '../domain/modelAnalysis';
import { parseSplit } from '../domain/split';
import { ModelWorkerClient } from '../services/ModelWorkerClient';
import ModelAudit from './ModelAudit';

afterEach(cleanup);

function analysis() {
  const tree = (split: string, gain: number) => ({ score: 0, sampleCount: 2, split, condition: parseSplit(split), gain, left: { score: -.1, sampleCount: 1 }, right: { score: .1, sampleCount: 1 } });
  const model: AGBModel = { modelVersion: '2', scoringStatus: 'unverified-preview', successRate: .0842, trees: [tree('Customer.Age < 35', .1), tree('IH.Web.Inbound.ClickCount < 3', .2)] };
  return analyseModel(model).summary;
}

it('explains metric origins, unavailable data and the exported success rate in human-readable units', () => {
  render(<ModelAudit analysis={analysis()} client={new ModelWorkerClient()} onNode={() => {}} onPredictor={() => {}} />);
  const success = screen.getByRole('heading', { name: 'Exported success rate' }).closest('article')!;
  expect(success).toHaveTextContent('8.42%');
  expect(success).toHaveTextContent('From the export');
  expect(success).toHaveTextContent('not a new measurement');
  const auc = screen.getByRole('heading', { name: 'Exported pooled AUC' }).closest('article')!;
  expect(auc).toHaveTextContent('Not available');
  expect(screen.getByText(/Each tree adds a score/)).toBeVisible();
  expect(screen.getByText(/not a model-health verdict/)).toBeVisible();
});

it('rounds visible shares but keeps the original unrounded evidence in a disclosure', async () => {
  const summary = analysis(), user = userEvent.setup();
  render(<ModelAudit analysis={summary} client={new ModelWorkerClient()} onNode={() => {}} onPredictor={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Predictors' }));
  const table = screen.getByRole('table', { name: /Exact predictor evidence across/ });
  const row = within(table).getByRole('row', { name: /Customer.Age/ });
  expect(row).toHaveTextContent('33.33% of total');
  const exact = within(row).getByText(String(summary.audit!.predictors[0].gainShare), { exact: true });
  expect(exact).not.toBeVisible();
  const disclosure = within(row).getByText('Exact numbers', { exact: true });
  await user.click(disclosure);
  expect(exact).toBeVisible();
});
