import { parseAGBText } from '../domain/importModel';
import { analyseModel, OCCURRENCE_PAGE_SIZE } from '../domain/modelAnalysis';
import type { PredictorOccurrence } from '../domain/predictorSearch';
import type { TreeNode } from '../domain/agb';
import type { WireNode, WorkerReply, WorkerRequest } from '../services/workerProtocol';

let occurrences = new Map<string, PredictorOccurrence[]>();
function send(message: WorkerReply) { self.postMessage(message); }
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.kind === 'occurrences') {
    const { feature, offset, requestId } = event.data;
    send({ kind: 'occurrences', requestId, entries: (occurrences.get(feature) ?? []).slice(offset, offset + OCCURRENCE_PAGE_SIZE) });
    return;
  }
  try {
    send({ kind: 'progress', message: 'Reading, parsing and validating locally…' });
    const start = performance.now();
    const result = parseAGBText(await event.data.file.text(), event.data.file.size);
    const parseMs = performance.now() - start;
    if (!result.model) { send({ kind: 'invalid', result }); return; }
    send({ kind: 'progress', message: 'Indexing trees and predictors locally…' });
    const analysisStart = performance.now();
    const analysis = analyseModel(result.model);
    analysis.summary.timings = { parseMs, analysisMs: performance.now() - analysisStart };
    occurrences = analysis.occurrences;
    const { trees, ...model } = result.model;
    send({ kind: 'metadata', model, diagnostics: { issues: result.issues, nodeCount: result.nodeCount, maxDepth: result.maxDepth }, analysis: analysis.summary });
    send({ kind: 'progress', message: 'Preparing the workspace in bounded chunks…' });
    let index = 0;
    let entries: WireNode[] = [];
    const pending: Array<{ node: TreeNode; parent: number | null; side?: 'left' | 'right'; treeIndex: number }> = [];
    for (let treeIndex = trees.length - 1; treeIndex >= 0; treeIndex -= 1) pending.push({ node: trees[treeIndex], parent: null, treeIndex });
    while (pending.length) {
      const current = pending.pop()!;
      const { left, right, ...node } = current.node;
      const parent = index++;
      entries.push({ node, parent: current.parent, side: current.side, treeIndex: current.treeIndex });
      if (right) pending.push({ node: right, parent, side: 'right', treeIndex: current.treeIndex });
      if (left) pending.push({ node: left, parent, side: 'left', treeIndex: current.treeIndex });
      if (entries.length === 512) {
        send({ kind: 'nodes', entries });
        entries = [];
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    if (entries.length) send({ kind: 'nodes', entries });
    send({ kind: 'complete' });
  } catch {
    send({ kind: 'failure', message: 'The local analysis worker could not read or analyse this export. Try another file or reload; no model data was sent.' });
  }
};
