import { afterEach, expect, it, vi } from 'vitest';
import { prepareFullModelRequest } from './fullModelRequest';
import { buildFullModelPayload, MAX_FULL_REQUEST_BYTES } from './fullModel';
import { ANTHROPIC } from './anthropic';
import { fixture } from './contextFixture';

afterEach(() => vi.unstubAllGlobals());
const text = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

it.each(['copilot', 'anthropic'] as const)('prepares only previously computed bounded evidence for %s, without rereading a file or launching a worker', async provider => {
  const worker = vi.fn();
  vi.stubGlobal('Worker', worker);
  const evidence = fixture().analysis.modelEvidence!;
  const model = provider === 'copilot' ? 'auto' : ANTHROPIC.defaultModel;
  const result = prepareFullModelRequest(provider, model, evidence);
  const payload = buildFullModelPayload(provider, model, evidence);
  expect(JSON.parse(await text(result.body))).toEqual({ provider, payload, approved: true, evidenceApproved: true });
  expect(JSON.parse(await text(result.preview))).toEqual(payload);
  expect(result.evidenceBytes).toBe(new TextEncoder().encode(JSON.stringify(evidence)).byteLength);
  expect(result.body.size).toBeLessThanOrEqual(MAX_FULL_REQUEST_BYTES);
  expect(result.preview.size).toBeLessThanOrEqual(MAX_FULL_REQUEST_BYTES);
  expect(worker).not.toHaveBeenCalled();
});

it('does not fall back to raw-file or selected-context transfer when whole-model evidence is unavailable', () => {
  expect(() => prepareFullModelRequest('copilot', 'auto', undefined)).toThrow();
});
