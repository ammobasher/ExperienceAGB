import { CopilotClient, RuntimeConnection } from '@github/copilot-sdk';
import type { CopilotClientOptions, SessionConfig } from '@github/copilot-sdk';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLIENT_REQUEST_TIMEOUT_MS, COPILOT_CLEANUP_TIMEOUT_MS, CommentaryError, REQUEST_TIMEOUT_MS } from '../src/ai/anthropic.ts';
import type { AIErrorCode } from '../src/ai/anthropic.ts';
import type { CopilotPayload } from '../src/ai/providers.ts';
import { isFullModelPayload } from '../src/ai/fullModel.ts';

export function childEnvironment(source: NodeJS.ProcessEnv, isolatedHome: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR']) {
    if (source[key]) env[key] = source[key];
  }
  env.HOME = isolatedHome; env.USERPROFILE = isolatedHome;
  env.XDG_CONFIG_HOME = isolatedHome; env.APPDATA = isolatedHome; env.LOCALAPPDATA = isolatedHome;
  env.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT = 'false';
  env.COPILOT_OTEL_ENABLED = 'false';
  return env;
}
export function commentarySession(payload: CopilotPayload, directory: string, onError?: (error: string, context: string) => void): SessionConfig {
  return {
    model: 'auto', availableTools: [], excludedTools: ['builtin:*', 'mcp:*', 'custom:*'], tools: [],
    workingDirectory: directory, configDirectory: directory, additionalDirectories: [],
    systemMessage: payload.systemMessage, enableConfigDiscovery: false, skipCustomInstructions: true,
    enableOnDemandInstructionDiscovery: false, enableHostGitOperations: false,
    enableSessionStore: false, enableSkills: false, enableFileHooks: false,
    enableFileChangeTracking: false, enableSessionTelemetry: false,
    requestExtensions: false, requestCanvasRenderer: false, enableMcpApps: false,
    enableExperimentalMode: false, manageScheduleEnabled: false, coauthorEnabled: false,
    memory: { enabled: false }, infiniteSessions: { enabled: false }, skipEmbeddingRetrieval: true,
    embeddingCacheStorage: 'in-memory', remoteSession: 'off',
    mcpServers: {}, customAgents: [], pluginDirectories: [], skillDirectories: [],
    agentDirectories: [], hookDirectories: [], instructionDirectories: [],
    includedBuiltinSkills: [], toolSearch: { enabled: false }, imageGeneration: { enabled: false },
    largeOutput: { enabled: false }, streaming: true,
    onPermissionRequest: () => ({ kind: 'denied-interactively-by-user' }),
    onAutoModeSwitchRequest: () => 'no',
    hooks: {
      onPreToolUse: () => ({ permissionDecision: 'deny' }),
      onUserPromptTransformed: () => ({ modifiedTransformedPrompt: payload.prompt }),
      onErrorOccurred: input => {
        onError?.(input.error, input.errorContext);
        return { errorHandling: 'abort', retryCount: 0, suppressOutput: true };
      },
    },
  };
}
export interface SDKSession {
  sessionId: string;
  on: Awaited<ReturnType<CopilotClient['createSession']>>['on'];
  sendAndWait(options: { prompt: string }, timeout: number): Promise<{ data: { content: string } } | undefined>;
  abort(): Promise<void>;
  disconnect(): Promise<void>;
}
export interface SDKClient {
  start(): Promise<void>;
  getAuthStatus(): Promise<{ isAuthenticated: boolean }>;
  createSession(config: SessionConfig): Promise<SDKSession>;
  deleteSession(id: string): Promise<void>;
  stop(): Promise<Error[]>;
  forceStop(): Promise<void>;
}
const SAFE_HTTP_STATUSES = [400, 401, 402, 403, 404, 408, 413, 422, 429, 500, 502, 503, 504, 529] as const;
export type CopilotFailureDetail = 'state-busy' | 'state-permission' | 'state-timeout' | 'state-other'
  | 'runtime-exit' | 'runtime-connection' | 'sdk-timeout' | 'sdk-network' | 'sdk-error'
  | 'hook-model-call' | 'hook-tool-execution' | 'hook-system' | 'hook-user-input' | 'hook-error'
  | 'session-error' | 'session-context-limit' | 'session-authorization' | 'session-rate-limit' | 'session-quota'
  | `session-http-${typeof SAFE_HTTP_STATUSES[number]}`;
function sessionFailure(errorType: string, statusCode?: number): { code: AIErrorCode; detail: CopilotFailureDetail } {
  const code: AIErrorCode = errorType === 'rate_limit' || statusCode === 429 ? 'rate'
    : ['authentication', 'authorization', 'auth', 'policy'].includes(errorType) || statusCode === 401 || statusCode === 403 ? 'auth'
    : errorType === 'quota' || statusCode === 402 ? 'billing'
    : errorType === 'context_limit' || statusCode === 413 ? 'context'
    : statusCode === 408 || statusCode === 504 ? 'timeout' : 'provider';
  const safeStatus = SAFE_HTTP_STATUSES.find(status => status === statusCode);
  const detail: CopilotFailureDetail = code === 'context' && errorType === 'context_limit' ? 'session-context-limit'
    : safeStatus !== undefined ? `session-http-${safeStatus}`
    : code === 'auth' ? 'session-authorization' : code === 'rate' ? 'session-rate-limit'
    : code === 'billing' ? 'session-quota' : 'session-error';
  return { code, detail };
}
type CopilotFailure = { code: AIErrorCode; detail: CopilotFailureDetail };
function messageFailure(value: unknown): CopilotFailure | undefined {
  // Inspect only a bounded prefix for fixed SDK/Node transport signatures; never retain the text.
  if (typeof value !== 'string') return;
  const message = value.slice(0, 8192).replace(/^Error: /, '');
  if (/^CLI server exited (?:unexpectedly )?with code (?:-?\d+|null)(?:\nstderr: [\s\S]*)?$/.test(message)) {
    return { code: 'runtime', detail: 'runtime-exit' };
  }
  if (['Session disconnected while waiting for a response', 'Session is disconnected',
    'CLI server connection closed during startup', 'Connection is closed.', 'Connection is disposed.',
    'Pending response rejected since connection got disposed'].includes(message)) {
    return { code: 'runtime', detail: 'runtime-connection' };
  }
  if (/^Timeout after \d+ms waiting for session\.idle$/.test(message) || message === 'Timeout waiting for CLI server to start') {
    return { code: 'timeout', detail: 'sdk-timeout' };
  }
  const transport = /^(?:connect|read|write|socket) (ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT)\b/.exec(message);
  if (transport?.[1] === 'ETIMEDOUT') return { code: 'timeout', detail: 'sdk-timeout' };
  if (transport || message === 'fetch failed') return { code: 'network', detail: 'sdk-network' };
}
function sdkFailure(error: unknown): CopilotFailure {
  return messageFailure(error instanceof Error ? error.message : undefined) ?? { code: 'provider', detail: 'sdk-error' };
}
function hookFailure(error: string, context: string): CopilotFailure {
  const classified = messageFailure(error);
  if (classified) return classified;
  const detail: CopilotFailureDetail = context === 'model_call' ? 'hook-model-call'
    : context === 'tool_execution' ? 'hook-tool-execution' : context === 'system' ? 'hook-system'
    : context === 'user_input' ? 'hook-user-input' : 'hook-error';
  return { code: 'provider', detail };
}
export interface CopilotOptions {
  token?: string;
  clientFactory?: (options: CopilotClientOptions) => SDKClient;
  onStage?: (stage: 'runtime-start' | 'authentication' | 'session-create' | 'inference' | 'cleanup') => void;
  removeState?: typeof rm;
  onFailure?: (operation: 'request' | 'abort' | 'session-disconnect' | 'session-delete' | 'stop' | 'force-stop' | 'state-removal', code: AIErrorCode, detail?: CopilotFailureDetail) => void;
}
async function bounded<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new CommentaryError('timeout')), ms); })]); }
  finally { clearTimeout(timer); }
}
export async function runCopilot(payload: CopilotPayload, signal: AbortSignal, {
  token = '', clientFactory = options => new CopilotClient(options), onStage, onFailure, removeState = rm,
}: CopilotOptions = {}): Promise<string> {
  signal.throwIfAborted();
  if (!token) throw new CommentaryError('configuration');
  const directory = await mkdtemp(join(tmpdir(), 'experience-agb-copilot-'));
  const home = join(directory, 'home');
  const workspace = join(directory, 'workspace');
  let client: SDKClient | undefined;
  let session: SDKSession | undefined;
  let unsubscribe: (() => void) | undefined;
  let completed = false;
  const fullModel = isFullModelPayload(payload);
  let responseFailure: CommentaryError | undefined;
  let originalHookFailure: CopilotFailure | undefined;
  let failureDetail: CopilotFailureDetail | undefined;
  let rejectAbort: ((reason: unknown) => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => { rejectAbort = reject; });
  // Observe aborts during setup as well as those raced with active SDK operations.
  void cancelled.catch(() => {});
  const abort = () => rejectAbort?.(new CommentaryError('cancelled'));
  const rejectResponse = (code: AIErrorCode) => {
    responseFailure ??= new CommentaryError(code);
    rejectAbort?.(responseFailure);
  };
  signal.addEventListener('abort', abort, { once: true });
  async function wait<T>(operation: () => Promise<T>) {
    signal.throwIfAborted();
    return Promise.race([operation(), cancelled]);
  }
  try {
    await Promise.all([mkdir(home), mkdir(workspace)]);
    signal.throwIfAborted();
    const runtime = clientFactory({
      connection: RuntimeConnection.forStdio(),
      mode: 'empty', baseDirectory: home, workingDirectory: workspace,
      env: childEnvironment(process.env, home), gitHubToken: token, useLoggedInUser: false,
      logLevel: 'none', sessionIdleTimeoutSeconds: Math.ceil(CLIENT_REQUEST_TIMEOUT_MS / 1000),
    });
    client = runtime;
    onStage?.('runtime-start');
    await wait(() => runtime.start());
    onStage?.('authentication');
    const auth = await wait(() => runtime.getAuthStatus());
    if (!auth.isAuthenticated) throw new CommentaryError('auth');
    onStage?.('session-create');
    const activeSession = await wait(() => runtime.createSession(commentarySession(payload, workspace, (error, context) => {
      const failure = hookFailure(error, context);
      if (!originalHookFailure || originalHookFailure.code === 'provider') originalHookFailure = failure;
    })));
    session = activeSession;
    let outputBytes = 0;
    unsubscribe = session.on(event => {
      if (event.type === 'assistant.message_delta') {
        outputBytes += Buffer.byteLength(event.data.deltaContent);
        if (outputBytes > (fullModel ? 128_000 : 32_000)) rejectResponse('oversized');
      }
      if (event.type === 'tool.execution_start') rejectResponse('response');
      if (event.type === 'session.truncation' && (
        event.data.tokensRemovedDuringTruncation !== 0 || event.data.messagesRemovedDuringTruncation !== 0
        || event.data.preTruncationTokensInMessages !== event.data.postTruncationTokensInMessages
        || event.data.preTruncationMessagesLength !== event.data.postTruncationMessagesLength
      )) rejectResponse('response');
      if (event.type === 'assistant.usage' && event.data.finishReason !== undefined && event.data.finishReason !== 'stop') rejectResponse('response');
      if (event.type === 'session.error') {
        if (!responseFailure) {
          const structured = sessionFailure(event.data.errorType, event.data.statusCode);
          const failure = structured.detail === 'session-error'
            ? messageFailure(event.data.message) ?? originalHookFailure ?? structured : structured;
          failureDetail = failure.detail;
          rejectResponse(failure.code);
        }
      }
    });
    onStage?.('inference');
    const result = await wait(() => activeSession.sendAndWait({ prompt: payload.prompt }, REQUEST_TIMEOUT_MS));
    if (responseFailure) throw responseFailure;
    if (originalHookFailure) {
      failureDetail = originalHookFailure.detail;
      throw new CommentaryError(originalHookFailure.code);
    }
    const text = result?.data.content?.trim();
    if (!text || text.length > (fullModel ? 32_000 : 8000) || Buffer.byteLength(text) > (fullModel ? 128_000 : 32_000)) throw new CommentaryError('response');
    completed = true;
    return text;
  } catch (error) {
    const cause = responseFailure ?? error;
    const sdk = sdkFailure(cause);
    const classified = cause instanceof CommentaryError ? { code: cause.code, detail: failureDetail }
      : sdk.code === 'provider' ? originalHookFailure ?? sdk : sdk;
    const failure = cause instanceof CommentaryError ? cause : new CommentaryError(signal.aborted ? 'cancelled' : classified.code);
    onFailure?.('request', failure.code, classified.detail);
    throw failure;
  } finally {
    const cleanupStartedAt = performance.now();
    onStage?.('cleanup');
    signal.removeEventListener('abort', abort); unsubscribe?.();
    let cleanupFailed = false;
    if (client) {
      if (!completed && session) {
        try { await bounded(session.abort(), 1000); }
        catch { onFailure?.('abort', 'cleanup'); }
      }
      if (session) {
        try { await bounded(session.disconnect(), 3000); }
        catch { onFailure?.('session-disconnect', 'cleanup'); }
        try { await bounded(client.deleteSession(session.sessionId), 1000); }
        catch { onFailure?.('session-delete', 'cleanup'); }
      }
      let forceStop = false;
      try {
        // The supported SDK has separate shutdown, graceful-exit and post-kill waits.
        const errors = await bounded(client.stop(), 35_000);
        forceStop = errors.length > 0;
        if (forceStop) onFailure?.('stop', 'cleanup');
      } catch { forceStop = true; onFailure?.('stop', 'cleanup'); }
      if (forceStop) {
        try { await bounded(client.forceStop(), 2000); }
        catch { cleanupFailed = true; onFailure?.('force-stop', 'cleanup'); }
      }
    }
    try {
      // Windows can briefly retain handles after the owned runtime exits.
      const remaining = COPILOT_CLEANUP_TIMEOUT_MS - (performance.now() - cleanupStartedAt);
      if (remaining <= 0) throw new CommentaryError('timeout');
      await bounded(removeState(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }), remaining);
    } catch (error) {
      cleanupFailed = true;
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      const detail = error instanceof CommentaryError && error.code === 'timeout' ? 'state-timeout'
        : code === 'EBUSY' || code === 'ENOTEMPTY' ? 'state-busy' : code === 'EPERM' || code === 'EACCES' ? 'state-permission' : 'state-other';
      onFailure?.('state-removal', 'cleanup', detail);
    }
    if (cleanupFailed) {
      console.error('Copilot runtime cleanup failed. Stop the local bridge and inspect its isolated temporary state.');
      throw new CommentaryError('cleanup');
    }
  }
}
