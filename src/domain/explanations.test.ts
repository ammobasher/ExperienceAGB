import { expect, it } from 'vitest';
import { explainNode } from './explanations';

it('explains splits as questions and leaves as additive contributions, not probabilities', () => {
  expect(explainNode({ score: 0, sampleCount: 1, split: 'Age < 35' }).question).toBe('Is Age less than 35?');
  expect(explainNode({ score: 0, sampleCount: 1, split: 'Channel in [Web, Store]' }).question).toMatch(/Channel.*Web.*Store/);
  expect(explainNode({ score: 0, sampleCount: 1, split: 'Age is Missing' }).question).toBe('Is Age missing?');
  expect(explainNode({ score: -0.2, sampleCount: 1 }).description).toMatch(/contributes -0.2000.*not a probability/);
});
