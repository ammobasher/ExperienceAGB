import { CommentaryError } from './anthropic';
import { buildFullModelPayload, MAX_FULL_REQUEST_BYTES } from './fullModel';
import type { ModelEvidence } from '../domain/modelEvidence';
import type { ProviderId } from './providers';

export interface PreparedModelRequest {
  body: Blob;
  preview: Blob;
  evidenceBytes: number;
}

export function prepareFullModelRequest(provider: ProviderId, model: string, evidence: ModelEvidence | undefined): PreparedModelRequest {
  const payload = buildFullModelPayload(provider, model, evidence);
  const body = new Blob([JSON.stringify({ provider, payload, approved: true, evidenceApproved: true })], { type: 'application/json' });
  const preview = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  if (body.size > MAX_FULL_REQUEST_BYTES || preview.size > MAX_FULL_REQUEST_BYTES) throw new CommentaryError('oversized');
  return { body, preview, evidenceBytes: new TextEncoder().encode(JSON.stringify(evidence)).byteLength };
}
