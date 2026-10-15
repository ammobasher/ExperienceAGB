import { parseAGBText } from '../domain/importModel';
import { analyseModel, OCCURRENCE_PAGE_SIZE } from '../domain/modelAnalysis';
import type { PredictorOccurrence } from '../domain/predictorSearch';
import type { TreeNode } from '../domain/agb';
import type { WireNode, WorkerReply, WorkerRequest } from '../services/workerProtocol';
import { summarizeEvolution } from '../domain/modelEvolution';
import { hashAuditCategories, sha256 } from '../domain/modelAudit';
import { buildAuditExport } from '../domain/auditExport';
import type { ModelAnalysis } from '../domain/modelAnalysis';
import type { ValidationIssue } from '../domain/agb';

let occurrences = new Map<string, PredictorOccurrence[]>();
let resumeTransfer: (() => void) | undefined;
let inFlightChunks = 0;
let exportSource: { analysis: ModelAnalysis; issues: ValidationIssue[] } | undefined;
const MAX_IN_FLIGHT_CHUNKS = 4;
function send(message: WorkerReply) { self.postMessage(message); }
async function sendNodes(entries: WireNode[]) {
  if (inFlightChunks >= MAX_IN_FLIGHT_CHUNKS) {
    await new Promise<void>(resolve => { resumeTransfer = resolve; });
  }
  inFlightChunks += 1;
  send({ kind: 'nodes', entries });
}
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.kind === 'audit-export') {
    const { requestId, format } = event.data;
    try {
      if (!exportSource) throw new Error('The local audit is not ready. Reopen the model and retry.');
      send({ kind: 'audit-export', requestId, file: buildAuditExport(exportSource.analysis, exportSource.issues, format) });
    } catch (cause) {
      send({ kind: 'audit-export-error', requestId, message: cause instanceof Error ? cause.message : 'The local audit export failed. Retry; no file was uploaded.' });
    }
    return;
  }
  if (event.data.kind === 'next-chunk') {
    inFlightChunks = Math.max(0, inFlightChunks - 1);
    const resume = resumeTransfer;
    resumeTransfer = undefined;
    resume?.();
    return;
  }
  if (event.data.kind === 'occurrences') {
    const { feature, offset, requestId } = event.data;
    send({ kind: 'occurrences', requestId, entries: (occurrences.get(feature) ?? []).slice(offset, offset + OCCURRENCE_PAGE_SIZE) });
    return;
  }
  try {
    send({ kind: 'progress', message: 'Reading, parsing and validating locally…' });
    const start = performance.now();
    const evolution = event.data.kind === 'evolution-import';
    const sourceBytes = await event.data.file.arrayBuffer();
    const text = new TextDecoder().decode(sourceBytes);
    const result = parseAGBText(text, event.data.file.size);
    const parseMs = performance.now() - start;
    if (!result.model) { send({ kind: 'invalid', result }); return; }
    send({ kind: 'progress', message: 'Indexing trees and predictors locally…' });
    const analysisStart = performance.now();
    const analysis = analyseModel(result.model, event.data.file.size);
    const digest = await sha256(sourceBytes);
    analysis.summary.sourceDigest = digest;
    if (analysis.summary.audit) await hashAuditCategories(analysis.summary.audit, analysis.categories);
    if (evolution) {
      send({ kind: 'evolution-summary', summary: { ...summarizeEvolution(result, analysis.summary), digest }, issues: result.issues });
      return;
    }
    analysis.summary.timings = { parseMs, analysisMs: performance.now() - analysisStart };
    exportSource = { analysis: analysis.summary, issues: result.issues };
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
        await sendNodes(entries);
        entries = [];
      }
    }
    if (entries.length) await sendNodes(entries);
    send({ kind: 'complete' });
  } catch {
    send({ kind: 'failure', message: 'The local analysis worker could not read or analyse this export. Try another file or reload; no model data was sent.' });
  }
};
