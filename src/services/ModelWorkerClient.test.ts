import { describe, expect, it, vi } from 'vitest';
import { ModelWorkerClient } from './ModelWorkerClient';
import type { WorkerRequest } from './workerProtocol';
import { summarizeEvolution } from '../domain/modelEvolution';
import { validateAGBExport } from '../domain/importModel';
import { analyseModel } from '../domain/modelAnalysis';

class FakeWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  messages: WorkerRequest[] = [];
  postMessage(message: WorkerRequest) { this.messages.push(message); }
  terminate() { this.terminated = true; }
}

describe('worker lifecycle', () => {
  it('delivers local audit blobs, surfaces preparation failures without killing navigation, and rejects pending exports on close', async () => {
    const worker = new FakeWorker(), client = new ModelWorkerClient(() => worker);
    const loading = client.load(new Blob(['{}']));
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'metadata', model: {}, diagnostics: { issues: [], nodeCount: 1, maxDepth: 0 }, analysis: {} } }));
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'nodes', entries: [{ parent: null, treeIndex: 0, node: { score: 0, sampleCount: 0 } }] } }));
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'complete' } }));
    await loading;
    const pending = client.getAuditExport('json'), file = new Blob(['{"manifest":{}}']);
    const request = worker.messages.at(-1);
    if (request?.kind !== 'audit-export') throw new Error('Missing export request.');
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'audit-export', requestId: request.requestId, file } }));
    expect(await pending).toBe(file);
    const failed = client.getAuditExport('html'), failure = worker.messages.at(-1);
    const rejection = expect(failed).rejects.toThrow('Visible export failure');
    if (failure?.kind !== 'audit-export') throw new Error('Missing export request.');
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'audit-export-error', requestId: failure.requestId, message: 'Visible export failure' } }));
    await rejection;
    expect(worker.terminated).toBe(false);
    const abandoned = expect(client.getAuditExport('json')).rejects.toMatchObject({ name: 'AbortError' });
    client.dispose(); await abandoned;
    await expect(client.getAuditExport('json')).rejects.toThrow('unavailable');
  });
  it('imports summary-only evolution data and terminates its dedicated worker without transferring trees', async () => {
    const worker = new FakeWorker(), active = new FakeWorker();
    const workspaceClient = new ModelWorkerClient(() => active), historyClient = new ModelWorkerClient(() => worker);
    const workspaceLoad = workspaceClient.load(new Blob(['{}']));
    const progress = vi.fn();
    const pending = historyClient.readEvolution(new Blob(['{}']), undefined, progress);
    expect(worker.messages).toHaveLength(1);
    expect(worker.messages[0].kind).toBe('evolution-import');
    const result = validateAGBExport({ type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST', model: { booster: { trees: [{ score: 0, sampleCount: 1 }] } } }, 100);
    const summary = { ...summarizeEvolution(result, analyseModel(result.model!).summary), digest: 'synthetic-hash' };
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'progress', message: 'Indexing locally' } }));
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'evolution-summary', summary, issues: [] } }));
    expect(await pending).toEqual({ summary, issues: [] });
    expect(progress).toHaveBeenCalledWith('Indexing locally');
    expect(worker.terminated).toBe(true);
    expect(worker.onmessage).toBeNull();
    expect(active.terminated).toBe(false);
    const rejection = expect(workspaceLoad).rejects.toMatchObject({ name: 'AbortError' });
    workspaceClient.dispose(); await rejection;
  });

  it('rejects summary import on abort, startup, message decoding, provider-free worker failure or unexpected tree transfer', async () => {
    for (const scenario of ['abort', 'decode', 'failure', 'unexpected', 'post']) {
      const worker = new FakeWorker(), abort = new AbortController();
      if (scenario === 'post') worker.postMessage = () => { throw new Error('Blocked'); };
      const client = new ModelWorkerClient(() => worker);
      const pending = client.readEvolution(new Blob(['{}']), abort.signal);
      const rejection = expect(pending).rejects.toMatchObject({ name: scenario === 'abort' ? 'AbortError' : 'Error' });
      if (scenario === 'abort') abort.abort();
      if (scenario === 'decode') worker.dispatchEvent(new MessageEvent('messageerror'));
      if (scenario === 'failure') worker.onmessage?.(new MessageEvent('message', { data: { kind: 'failure', message: 'Local read failed' } }));
      if (scenario === 'unexpected') worker.onmessage?.(new MessageEvent('message', { data: { kind: 'nodes', entries: [] } }));
      await rejection;
      expect(worker.terminated).toBe(true);
    }
    await expect(new ModelWorkerClient(() => { throw new Error('Unavailable'); }).readEvolution(new Blob())).rejects.toThrow(/could not start/i);
    const worker = new FakeWorker(), client = new ModelWorkerClient(() => worker);
    const pending = client.readEvolution(new Blob());
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'invalid', result: { model: null, issues: [{ severity: 'error', path: '$', message: 'Bad JSON' }], nodeCount: 0, maxDepth: 0 } } }));
    expect((await pending).summary).toBeUndefined();
    expect(worker.terminated).toBe(true);
  });

  it('acknowledges reconstructed chunks before requesting more and drops the import handler on completion', async () => {
    const worker = new FakeWorker();
    const client = new ModelWorkerClient(() => worker);
    const load = client.load(new Blob(['{}']));
    const importing = worker.onmessage;
    worker.onmessage?.(new MessageEvent('message', { data: {
      kind: 'metadata', model: {}, diagnostics: { issues: [], nodeCount: 1, maxDepth: 0 },
      analysis: { features: [], treeFacts: [], predictors: [] },
    } }));
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'nodes', entries: [
      { parent: null, treeIndex: 0, node: { score: 1, sampleCount: 1 } },
    ] } }));
    expect(worker.messages.at(-1)).toEqual({ kind: 'next-chunk' });
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'complete' } }));
    const workspace = await load;
    expect(workspace.result.model?.trees[0].score).toBe(1);
    expect(worker.onmessage).not.toBe(importing);
    client.dispose();
    expect(worker.onmessage).toBeNull();
  });

  it('terminates a rejected export instead of keeping an idle worker alive', async () => {
    const worker = new FakeWorker();
    const client = new ModelWorkerClient(() => worker);
    const load = client.load(new Blob(['{}']));
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'invalid', result: { issues: [], nodeCount: 0, maxDepth: 0 } } }));
    await load;
    expect(worker.terminated).toBe(true);
    expect(worker.onmessage).toBeNull();
  });

  it('rejects and terminates when a reconstructed chunk cannot be acknowledged', async () => {
    const worker = new FakeWorker();
    const client = new ModelWorkerClient(() => worker);
    const load = client.load(new Blob(['{}']));
    const rejected = expect(load).rejects.toThrow(/worker transfer failed/i);
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'metadata', model: {}, diagnostics: {}, analysis: {} } }));
    worker.postMessage = () => { throw new DOMException('Cannot post', 'InvalidStateError'); };
    worker.onmessage?.(new MessageEvent('message', { data: { kind: 'nodes', entries: [
      { parent: null, treeIndex: 0, node: { score: 1, sampleCount: 1 } },
    ] } }));
    await rejected;
    expect(worker.terminated).toBe(true);
    expect(worker.onmessage).toBeNull();
  });

  it('replaces workers, rejects outstanding pages and removes their timers on repeated close', async () => {
    vi.useFakeTimers();
    try {
      const workers: FakeWorker[] = [];
      const client = new ModelWorkerClient(() => { const worker = new FakeWorker(); workers.push(worker); return worker; });
      for (let cycle = 0; cycle < 5; cycle++) {
        const load = client.load(new Blob(['{}']));
        const worker = workers.at(-1)!;
        const pages = client.getOccurrences('Age', 20);
        const rejectedLoad = expect(load).rejects.toMatchObject({ name: 'AbortError' });
        const rejectedPages = expect(pages).rejects.toMatchObject({ name: 'AbortError' });
        client.dispose();
        client.dispose();
        await rejectedLoad; await rejectedPages;
        expect(worker.terminated).toBe(true);
        expect(worker.onmessage).toBeNull();
        expect(worker.onerror).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
      }
      expect(workers).toHaveLength(5);
    } finally { vi.useRealTimers(); }
  });

  it('terminates parsing on cancellation and rejects instead of silently falling back', async () => {
    const worker = new FakeWorker();
    const client = new ModelWorkerClient(() => worker);
    const abort = new AbortController();
    const pending = client.load(new Blob(['{}']), abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);
  });

  it('reports worker startup/failure explicitly', async () => {
    const worker = new FakeWorker();
    const client = new ModelWorkerClient(() => worker);
    const pending = client.load(new Blob(['{}']));
    worker.onerror?.(new ErrorEvent('error'));
    await expect(pending).rejects.toThrow(/analysis worker/i);
    expect(worker.terminated).toBe(true);
    const unavailable = new ModelWorkerClient(() => { throw new Error('blocked'); });
    await expect(unavailable.load(new Blob(['{}']))).rejects.toThrow(/analysis worker/i);
  });

  it('rejects deserialization failures and permits a fresh retry', async () => {
    const worker = new FakeWorker();
    const client = new ModelWorkerClient(() => worker);
    const pending = client.load(new Blob(['{}']));
    worker.dispatchEvent(new MessageEvent('messageerror'));
    expect(worker.terminated).toBe(true);
    await expect(pending).rejects.toThrow(/worker.*response/i);
  });

  it('clears pending timers and terminates when an occurrence request cannot be posted', async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const client = new ModelWorkerClient(() => worker);
      const load = client.load(new Blob(['{}']));
      worker.onmessage?.(new MessageEvent('message', { data: { kind: 'metadata', model: {}, diagnostics: {}, analysis: {} } }));
      worker.onmessage?.(new MessageEvent('message', { data: { kind: 'nodes', entries: [
        { parent: null, treeIndex: 0, node: { score: 1, sampleCount: 1 } },
      ] } }));
      worker.onmessage?.(new MessageEvent('message', { data: { kind: 'complete' } }));
      await load;
      worker.postMessage = () => { throw new DOMException('Cannot clone', 'DataCloneError'); };
      await expect(client.getOccurrences('Age', 20)).rejects.toThrow(/navigation request.*failed/i);
      expect(vi.getTimerCount()).toBe(0);
      expect(worker.terminated).toBe(true);
      await expect(client.getOccurrences('Age', 20)).rejects.toThrow(/unavailable/i);
    } finally { vi.useRealTimers(); }
  });
});
