import type { Server } from 'node:http';
import type { CopilotOptions, CopilotFailureDetail } from './copilot';
import type { AIErrorCode } from '../src/ai/anthropic';
import type { ProviderId } from '../src/ai/providers';
export interface AIRequestDiagnostic {
  requestId: string;
  provider: ProviderId | null;
  event: 'stage' | 'deadline' | 'finished' | 'failure';
  stage: 'validation' | 'runtime-start' | 'authentication' | 'session-create' | 'inference' | 'response-read' | 'cleanup' | 'cleanup-abort' | 'cleanup-session-disconnect' | 'cleanup-session-delete' | 'cleanup-stop' | 'cleanup-force-stop' | 'cleanup-state-removal';
  elapsedMs: number;
  result: AIErrorCode | 'success' | null;
  detail?: CopilotFailureDetail;
}
export interface AIHostOptions {
  root?: string;
  base?: string;
  apiKey?: string;
  model?: string;
  uiOrigin?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxConcurrent?: number;
  copilotToken?: string;
  copilotClientFactory?: CopilotOptions['clientFactory'];
  onDiagnostic?: (record: AIRequestDiagnostic) => void;
}
export function createAIHost(options?: AIHostOptions): { server: Server; close(): Promise<void> };
