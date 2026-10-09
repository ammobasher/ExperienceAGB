import { describe, expect, it, vi } from 'vitest';
import { ModelWorkerClient } from './ModelWorkerClient';
import type { WorkerRequest } from './workerProtocol';

class FakeWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  messages: WorkerRequest[] = [];
  postMessage(message: WorkerRequest) { this.messages.push(message); }
  terminate() { this.terminated = true; }
}

describe('worker lifecycle', () => {
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
