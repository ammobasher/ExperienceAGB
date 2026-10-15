import { describe, expect, it } from 'vitest';
import { buildContext } from './context';
import { fixture } from './contextFixture';
import { buildProviderPayload, validateProviderSubmission, COPILOT } from './providers';

describe('explicit provider dispatch contract', () => {
  it('defaults to documented Copilot auto without an assumed inference endpoint', () => {
    const payload = buildProviderPayload('copilot', 'auto', buildContext(fixture(), 'model'));
    expect(payload).toMatchObject({ model: 'auto', systemMessage: { mode: 'replace' } });
    expect(payload).not.toHaveProperty('tools');
    expect(COPILOT.defaultModel).toBe('auto');
    expect(validateProviderSubmission({ provider: 'copilot', payload, approved: true, profileApproved: false })).toEqual({ provider: 'copilot', payload });
  });
  it('rejects provider substitution, extra prompts/tools, arbitrary models and profile consent mismatch', () => {
    const payload = buildProviderPayload('copilot', 'auto', buildContext(fixture(), 'trace', true));
    for (const body of [
      { provider: 'anthropic', payload, approved: true, profileApproved: true },
      { provider: 'copilot', payload: { ...payload, model: 'unapproved' }, approved: true, profileApproved: true },
      { provider: 'copilot', payload: { ...payload, tools: ['shell'] }, approved: true, profileApproved: true },
      { provider: 'copilot', payload, approved: true, profileApproved: false },
      { provider: 'copilot', payload, approved: false, profileApproved: true },
    ]) expect(() => validateProviderSubmission(body)).toThrow();
  });
  it('retains Anthropic only when explicitly selected', () => {
    const payload = buildProviderPayload('anthropic', 'claude-haiku-5-5', buildContext(fixture(), 'tree'));
    expect(validateProviderSubmission({ provider: 'anthropic', payload, approved: true, profileApproved: false })).toEqual({ provider: 'anthropic', payload });
  });
});
