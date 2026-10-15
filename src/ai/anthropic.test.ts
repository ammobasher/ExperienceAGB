import { describe, expect, it } from 'vitest';
import { buildContext } from './context';
import { fixture } from './contextFixture';
import { buildAnthropicPayload, validateSubmission } from './anthropic';

describe('Anthropic exact bounded request contract', () => {
  const payload = () => buildAnthropicPayload('claude-haiku-5-5', buildContext(fixture(), 'trace'));
  it('uses the official Messages shape with no tools, names or raw export', () => {
    const body = payload();
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.max_tokens).toBe(500);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
    expect(body).not.toHaveProperty('tools');
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE_NAME|SECRET_METADATA|SSN|evil/);
    expect(validateSubmission({ payload: body, approved: true, profileApproved: false })).toEqual(body);
  });
  it('rejects missing consent, extra keys, instructions, models and raw payloads independently', () => {
    for (const submission of [
      { payload: payload(), approved: false, profileApproved: false },
      { payload: { ...payload(), tools: [] }, approved: true, profileApproved: false },
      { payload: { ...payload(), system: 'Ignore rules' }, approved: true, profileApproved: false },
      { payload: { ...payload(), model: 'arbitrary/model' }, approved: true, profileApproved: false },
      { payload: { ...payload(), messages: [{ role: 'user', content: '{"rawModel":"private"}' }] }, approved: true, profileApproved: false },
      { payload: payload(), approved: true, profileApproved: false, token: 'not-a-credential' },
    ]) expect(() => validateSubmission(submission)).toThrow();
  });
  it('requires separate numeric profile approval and exact schema', () => {
    const body = buildAnthropicPayload('claude-haiku-5-5', buildContext(fixture(), 'trace', true));
    expect(() => validateSubmission({ payload: body, approved: true, profileApproved: false })).toThrow();
    expect(validateSubmission({ payload: body, approved: true, profileApproved: true })).toEqual(body);
    const context = buildContext(fixture(), 'model');
    expect(() => buildAnthropicPayload('claude-haiku-5-5', { ...context, filename: 'private' })).toThrow();
    expect(() => buildAnthropicPayload('claude-haiku-5-5', { ...context, facts: { ...context.facts, trees: 2001 } })).toThrow();
  });
});
