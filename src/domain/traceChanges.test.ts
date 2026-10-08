import { expect, it } from 'vitest';
import { changedTreeIndices } from './traceChanges';
import { traceEnsemblePreview } from './profileTrace';

it('identifies route changes even when the reached leaf contribution is unchanged', () => {
  const trees = [{ score: 0, sampleCount: 2, split: 'Age < 35', left: { score: 0.1, sampleCount: 1 }, right: { score: 0.1, sampleCount: 1 } }];
  const before = traceEnsemblePreview(trees, { Age: '35' });
  const after = traceEnsemblePreview(trees, { Age: '34' });
  expect(changedTreeIndices(before, after)).toEqual([0]);
  expect(changedTreeIndices(after, after)).toEqual([]);
});
