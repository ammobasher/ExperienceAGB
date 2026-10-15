import type { TreeNode } from '../domain/agb';
import type { PredictorOccurrence } from '../domain/predictorSearch';
import type { EvolutionImportResult, ImportedWorkspace, WorkerReply, WorkerRequest } from './workerProtocol';
import type { AuditExportFormat } from '../domain/auditExport';

interface WorkerPort {
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  addEventListener(type: 'messageerror', listener: EventListener): void;
  removeEventListener(type: 'messageerror', listener: EventListener): void;
  postMessage(message: WorkerRequest): void;
  terminate(): void;
}
export class ModelWorkerClient {
  private worker?: WorkerPort;
  private failLoad?: (error: Error) => void;
  private messageErrorListener?: EventListener;
  private requests = new Map<number, { resolve: (entries: PredictorOccurrence[]) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
  private requestId = 0;
  private exports = new Map<number, { resolve: (file: Blob) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
  constructor(private factory: () => WorkerPort = () => new Worker(new URL('../workers/model.worker.ts', import.meta.url), { type: 'module' })) {}

  load(file: Blob, signal?: AbortSignal, onProgress?: (message: string) => void): Promise<ImportedWorkspace> {
    this.dispose();
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException('Import cancelled.', 'AbortError')); return; }
      let workspace: ImportedWorkspace | undefined;
      const nodes: TreeNode[] = [];
      const abort = () => this.dispose();
      const finish = (result: ImportedWorkspace) => {
        signal?.removeEventListener('abort', abort);
        this.failLoad = undefined;
        nodes.length = 0;
        workspace = undefined;
        if (this.worker) this.worker.onmessage = ({ data }) => {
          if (data.kind === 'occurrences') this.receiveOccurrences(data);
          else if (data.kind === 'audit-export' || data.kind === 'audit-export-error') this.receiveExport(data);
          else if (data.kind === 'failure') this.fail(new Error(data.message));
        };
        resolve(result);
      };
      this.failLoad = error => { signal?.removeEventListener('abort', abort); reject(error); };
      signal?.addEventListener('abort', abort, { once: true });
      try {
        const worker = this.startWorker();
        worker.onmessage = ({ data }) => {
          if (data.kind === 'progress') onProgress?.(data.message);
          else if (data.kind === 'failure') this.fail(new Error(data.message));
          else if (data.kind === 'invalid') { finish({ result: data.result }); this.dispose(); }
          else if (data.kind === 'metadata') workspace = { result: { ...data.diagnostics, model: { ...data.model, trees: [] } }, analysis: data.analysis };
          else if (data.kind === 'nodes') {
            if (!workspace?.result.model) { this.fail(new Error('Invalid analysis worker response. Reload and retry.')); return; }
            for (const entry of data.entries) {
              const node: TreeNode = entry.node;
              nodes.push(node);
              if (entry.parent === null) workspace.result.model.trees[entry.treeIndex] = node;
              else if (entry.side && nodes[entry.parent]) nodes[entry.parent][entry.side] = node;
              else { this.fail(new Error('Invalid analysis worker tree response. Reload and retry.')); return; }
            }
            try { worker.postMessage({ kind: 'next-chunk' }); }
            catch { this.fail(new Error('The local analysis worker transfer failed. Reopen the model and retry.')); }
          } else if (data.kind === 'complete') {
            if (workspace?.result.model?.trees.length) finish(workspace);
            else this.fail(new Error('The analysis worker did not return a complete model.'));
          } else if (data.kind === 'occurrences') {
            this.receiveOccurrences(data);
          }

        };
        worker.postMessage({ kind: 'import', file });
      } catch { this.fail(new Error('The local analysis worker could not start. Allow local workers or use a supported browser, then retry.')); }
    });
  }

  readEvolution(file: Blob, signal?: AbortSignal, onProgress?: (message: string) => void): Promise<EvolutionImportResult> {
    this.dispose();
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException('Import cancelled.', 'AbortError')); return; }
      const abort = () => this.dispose();
      this.failLoad = error => { signal?.removeEventListener('abort', abort); reject(error); };
      signal?.addEventListener('abort', abort, { once: true });
      const finish = (result: EvolutionImportResult) => {
        signal?.removeEventListener('abort', abort);
        this.failLoad = undefined;
        this.dispose();
        resolve(result);
      };
      try {
        const worker = this.startWorker();
        worker.onmessage = ({ data }) => {
          if (data.kind === 'progress') onProgress?.(data.message);
          else if (data.kind === 'evolution-summary') finish({ summary: data.summary, issues: data.issues });
          else if (data.kind === 'invalid') finish({ issues: data.result.issues });
          else if (data.kind === 'failure') this.fail(new Error(data.message));
          else this.fail(new Error('The evolution worker returned an unexpected response. Retry the export; no model was uploaded.'));
        };
        worker.postMessage({ kind: 'evolution-import', file });
      } catch { this.fail(new Error('The local analysis worker could not start. Allow local workers or use a supported browser, then retry.')); }
    });
  }

  private startWorker() {
    const worker = this.factory();
    this.worker = worker;
    worker.onerror = () => this.fail(new Error('The local analysis worker failed. Reload and try again; no synchronous fallback or model upload was attempted.'));
    this.messageErrorListener = () => this.fail(new Error('The local analysis worker response could not be read. Reload and retry; no model upload was attempted.'));
    worker.addEventListener('messageerror', this.messageErrorListener);
    return worker;
  }

  private receiveOccurrences(data: Extract<WorkerReply, { kind: 'occurrences' }>) {
    const request = this.requests.get(data.requestId);
    if (request) {
      clearTimeout(request.timeout);
      this.requests.delete(data.requestId);
      request.resolve(data.entries);
    }
  }

  getOccurrences(feature: string, offset: number): Promise<PredictorOccurrence[]> {
    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('The local analysis worker is unavailable. Reopen the model.')); return; }
      const requestId = ++this.requestId;
      const timeout = setTimeout(() => {
        this.requests.delete(requestId);
        reject(new Error('Predictor navigation timed out. Retry or reopen the model.'));
      }, 20000);
      this.requests.set(requestId, { resolve, reject, timeout });
      try { this.worker.postMessage({ kind: 'occurrences', requestId, feature, offset }); }
      catch { this.fail(new Error('The local predictor navigation request failed. Reopen the model and retry; no model upload was attempted.')); }
    });
  }
  private fail(error: Error) {
    this.failLoad?.(error);
    this.failLoad = undefined;
    for (const request of this.requests.values()) { clearTimeout(request.timeout); request.reject(error); }
    this.requests.clear();
    for (const request of this.exports.values()) { clearTimeout(request.timeout); request.reject(error); }
    this.exports.clear();
    if (this.worker) {
      this.worker.onmessage = null; this.worker.onerror = null;
      if (this.messageErrorListener) this.worker.removeEventListener('messageerror', this.messageErrorListener);
      this.messageErrorListener = undefined;
      this.worker.terminate(); this.worker = undefined;
    }
  }
  getAuditExport(format: AuditExportFormat): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('The local analysis worker is unavailable. Reopen the model.')); return; }
      const requestId = ++this.requestId;
      const timeout = setTimeout(() => { this.exports.delete(requestId); reject(new Error('The local audit export timed out. Retry or reopen the model.')); }, 30000);
      this.exports.set(requestId, { resolve, reject, timeout });
      try { this.worker.postMessage({ kind: 'audit-export', requestId, format }); }
      catch { this.fail(new Error('The local audit export request failed. Reopen the model; no data was uploaded.')); }
    });
  }
  private receiveExport(data: Extract<WorkerReply, { kind: 'audit-export' | 'audit-export-error' }>) {
    const request = this.exports.get(data.requestId);
    if (!request) return;
    clearTimeout(request.timeout); this.exports.delete(data.requestId);
    if (data.kind === 'audit-export') request.resolve(data.file);
    else request.reject(new Error(data.message));
  }
  dispose() { this.fail(new DOMException('Import cancelled.', 'AbortError')); }
}
