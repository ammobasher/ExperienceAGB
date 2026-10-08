import { describe, expect, it, vi } from 'vitest';
import { ModelWorkerClient } from './ModelWorkerClient';

class FakeWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  postMessage() {}
  terminate() { this.terminated = true; }
}

describe('worker lifecycle', () => {
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
      worker.onmessage?.(new MessageEvent('message', { data: { kind: 'invalid', result: { issues: [], nodeCount: 0, maxDepth: 0 } } }));
      await load;
      worker.postMessage = () => { throw new DOMException('Cannot clone', 'DataCloneError'); };
      await expect(client.getOccurrences('Age', 20)).rejects.toThrow(/navigation request.*failed/i);
      expect(vi.getTimerCount()).toBe(0);
      expect(worker.terminated).toBe(true);
      await expect(client.getOccurrences('Age', 20)).rejects.toThrow(/unavailable/i);
    } finally { vi.useRealTimers(); }
  });
});
