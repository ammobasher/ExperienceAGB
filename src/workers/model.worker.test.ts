import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkerReply, WorkerRequest } from '../services/workerProtocol';
import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';

class TextBlob extends Blob {
  constructor(private readonly content: string) { super([content]); }
  override text(): Promise<string> { return Promise.resolve(this.content); }
  override arrayBuffer(): Promise<ArrayBuffer> { return new NodeBlob([this.content]).arrayBuffer(); }
}

function tree(depth: number): object {
  return depth ? { score: 0, sampleCount: 2 ** depth, split: `Feature${depth} < ${depth}`, left: tree(depth - 1), right: tree(depth - 1) }
    : { score: 0.001, sampleCount: 1 };
}

describe('bounded worker transfer', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('pipelines at most four bounded chunks, resumes on receiver acknowledgement, and pages occurrences', async () => {
    const messages: WorkerReply[] = [];
    const port: {
      onmessage?: (event: MessageEvent<WorkerRequest>) => Promise<void>;
      postMessage: (message: WorkerReply) => void;
    } = {
      postMessage: (message: WorkerReply) => { messages.push(message); },
    };
    vi.stubGlobal('self', port);
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('Blob', NodeBlob);
    await import('./model.worker');
    const pending = port.onmessage!(new MessageEvent('message', { data: {
      kind: 'import', file: new TextBlob(JSON.stringify({
        type: 'AdaptiveBoostScoringModel', modelVersion: '2', algorithm: 'GRADIENT_BOOST',
        model: { booster: { trees: [tree(11), ...Array.from({ length: 8 }, () => tree(0))] } },
      })),
    } }));
    await vi.waitFor(() => expect(messages.filter(message => message.kind === 'nodes')).toHaveLength(4));
    expect(messages.some(message => message.kind === 'complete')).toBe(false);
    for (let acknowledgement = 1; acknowledgement <= 4; acknowledgement++) {
      await port.onmessage!(new MessageEvent('message', { data: { kind: 'next-chunk' } }));
      await vi.waitFor(() => expect(messages.filter(message => message.kind === 'nodes')).toHaveLength(4 + acknowledgement));
      expect(messages.some(message => message.kind === 'complete')).toBe(false);
    }
    await port.onmessage!(new MessageEvent('message', { data: { kind: 'next-chunk' } }));
    await pending;
    const chunks = messages.filter(message => message.kind === 'nodes');
    expect(chunks.map(chunk => chunk.entries.length)).toEqual([512, 512, 512, 512, 512, 512, 512, 512, 7]);
    expect(messages.at(-1)?.kind).toBe('complete');
    await port.onmessage!(new MessageEvent('message', { data: { kind: 'occurrences', requestId: 1, feature: 'Feature1', offset: 20 } }));
    expect(messages.at(-1)).toMatchObject({ kind: 'occurrences', requestId: 1 });
    const page = messages.at(-1);
    if (page?.kind !== 'occurrences') throw new Error('Missing occurrence response.');
    expect(page.entries).toHaveLength(20);
    await port.onmessage!(new MessageEvent('message', { data: { kind: 'audit-export', requestId: 2, format: 'json' } }));
    const exported = messages.at(-1);
    if (exported?.kind !== 'audit-export') throw new Error('Missing local export response.');
    const bundle = JSON.parse(await exported.file.text());
    expect(bundle.manifest.source.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.manifest.coverage.nodes).toBe(4103);
    expect(bundle.figures.treeOrder).toHaveLength(9);
    expect(bundle.manifest.analysis.trees[0]).not.toHaveProperty('left');
  });
});
