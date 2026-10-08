import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { AGBModel, ImportResult } from './domain/agb';
import { IMPORT_LIMITS } from './domain/importModel';
import { OCCURRENCE_PAGE_SIZE } from './domain/modelAnalysis';
import type { ModelAnalysis, PredictorGroup } from './domain/modelAnalysis';
import type { PredictorOccurrence } from './domain/predictorSearch';
import { createIllustrativeProfile, traceEnsemblePreview } from './domain/profileTrace';
import type { EnsembleTrace } from './domain/profileTrace';
import { changedTreeIndices } from './domain/traceChanges';
import { ModelWorkerClient } from './services/ModelWorkerClient';
import type { ImportedWorkspace } from './services/workerProtocol';
import TreeDiagram from './components/TreeDiagram';
import ProfileTracePanel from './components/ProfileTracePanel';

const SAMPLE_URL = `${import.meta.env.BASE_URL}sample/export_PA_WebBuyNow_AGB_sample.json`;

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const client = useRef(new ModelWorkerClient()).current;
  const abortRef = useRef<AbortController>();
  const [workspace, setWorkspace] = useState<ImportedWorkspace>();
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => { abortRef.current?.abort(); client.dispose(); }, [client]);

  async function importFile(file: Blob, name: string, signal: AbortSignal) {
    const imported = await client.load(file, signal, setStatus);
    if (signal.aborted) return;
    setWorkspace(imported);
    setFileName(name);
    if (!imported.result.model) {
      const diagnostic = imported.result.issues.find(issue => issue.severity === 'error');
      setError(diagnostic ? `${diagnostic.path}: ${diagnostic.message} Review the full validation report below.` : 'The export could not be opened. Review the validation report and correct the file.');
    }
  }
  function begin() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(''); setWorkspace(undefined); setBusy(true); setStatus('Opening model locally…');
    return controller;
  }
  async function openFile(file?: File) {
    if (!file || busy) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Choose a Pega AGB export with a .json extension.'); return;
    }
    if (file.size > IMPORT_LIMITS.maxFileSizeBytes) {
      setError('This file is larger than the 25 MB limit.'); return;
    }
    const controller = begin();
    try { await importFile(file, file.name, controller.signal); }
    catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The local file could not be analysed. Retry or reload.');
    } finally { if (!controller.signal.aborted) { setBusy(false); setStatus(''); } }
  }
  async function openSample() {
    const controller = begin();
    try {
      const response = await fetch(SAMPLE_URL, { signal: controller.signal });
      if (!response.ok) throw new Error('The bundled sample could not be loaded. You can still open a local JSON file.');
      const text = await response.text();
      await importFile(new Blob([text]), 'Pega AGB sample', controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The bundled sample could not be loaded. Open a local JSON file instead.');
    } finally { if (!controller.signal.aborted) { setBusy(false); setStatus(''); } }
  }
  function cancelImport() {
    abortRef.current?.abort(); client.dispose(); setBusy(false); setStatus('');
    setError('Import cancelled. No model was saved or uploaded; choose a file to try again.');
  }
  function closeModel() { client.dispose(); setWorkspace(undefined); setFileName(''); setError(''); }
  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    void openFile(event.target.files?.[0]); event.target.value = '';
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); void openFile(event.dataTransfer.files[0]);
  }
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Experience AGB home"><span className="brand-mark">A</span><span>Experience <b>AGB</b></span></a>
        <div className="privacy-mark"><span /> Runs in this browser</div>
      </header>
      {workspace?.result.model && workspace.analysis ? (
        <Workspace model={workspace.result.model} analysis={workspace.analysis} result={workspace.result} fileName={fileName} client={client} onClose={closeModel} />
      ) : (
        <section className="start-layout" aria-labelledby="start-title">
          <div className="start-copy">
            <p className="eyebrow">PEGA MODEL EXPLORER <span>/</span> 01</p>
            <h1 id="start-title">Open a model.<br /><em>Find its shape.</em></h1>
            <p className="intro">Explore the observed Pega sample and UUID-v4-tagged export structures in a focused, local workspace. Other variants require adapter evidence; scoring remains unverified.</p>
            <div className="format-note"><span className="format-glyph">{ }</span><span><b>JSON exports only</b><small>Up to 25 MB · your file stays on this device</small></span></div>
          </div>
          <div className="open-panel" aria-busy={busy}>
            <div className="panel-heading"><span>MODEL INPUT</span><span className="step-index">A / 01</span></div>
            <div className={`drop-target${dragging ? ' is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <div className="file-glyph" aria-hidden="true"><span /><span /><span /></div>
              <h2>Choose an export file</h2><p>Drop a .json file here, or browse your device.</p>
              <button className="button button-primary" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? 'Reading model…' : 'Browse files'} <span>↗</span></button>
              <input ref={inputRef} type="file" accept=".json,application/json" hidden onChange={onInputChange} />
            </div>
            <div className="or-divider"><span>OR START WITH</span></div>
            <button className="sample-action" onClick={() => void openSample()} disabled={busy}>
              <span className="sample-icon">↗</span><span><b>Try the bundled sample</b><small>Small demonstration model</small></span><span className="sample-arrow">→</span>
            </button>
            {busy && <><p role="status">{status}</p><button className="button button-quiet" onClick={cancelImport}>Cancel import</button></>}
            {error && <p className="error-message" role="alert">{error}</p>}
            {!!workspace?.result.issues.length && <ValidationReport result={workspace.result} />}
          </div>
          <footer className="start-footer"><span>EXPERIENCE AGB</span><span>CLIENT-SIDE BY DESIGN</span><span>NO ACCOUNT REQUIRED</span></footer>
        </section>
      )}
    </main>
  );
}

function Workspace({ model, analysis, result, fileName, client, onClose }: {
  model: AGBModel; analysis: ModelAnalysis; result: ImportResult; fileName: string; client: ModelWorkerClient; onClose: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [selectedTree, setSelectedTree] = useState(0);
  const [view, setView] = useState<'explore' | 'trace'>('explore');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [treePage, setTreePage] = useState(0);
  const [treeSearch, setTreeSearch] = useState('');
  const [profileVariant, setProfileVariant] = useState(0);
  const [profileValues, setProfileValues] = useState(() => createIllustrativeProfile(analysis.features));
  const [profileRevision, setProfileRevision] = useState(0);
  const previousTrace = useRef<EnsembleTrace>();
  const [profileSearch, setProfileSearch] = useState('');
  const [predictorSearch, setPredictorSearch] = useState('');
  const [predictorPage, setPredictorPage] = useState(0);
  const [focusedNodeId, setFocusedNodeId] = useState<string>();
  const [focusRequest, setFocusRequest] = useState(0);
  const ensembleTrace = useMemo(() => traceEnsemblePreview(model.trees, profileValues, analysis.features), [model.trees, profileValues, analysis.features]);
  const changedTrees = useMemo(() => previousTrace.current ? changedTreeIndices(previousTrace.current, ensembleTrace) : [], [ensembleTrace]);
  const tree = model.trees[selectedTree], facts = analysis.treeFacts[selectedTree], stage = ensembleTrace.stages[selectedTree];
  useEffect(() => { titleRef.current?.focus(); }, []);
  const filteredPredictors = useMemo(() => analysis.predictors.filter(group => group.feature.toLowerCase().includes(predictorSearch.trim().toLowerCase())), [analysis.predictors, predictorSearch]);
  const filteredTrees = useMemo(() => analysis.treeFacts.map((facts, index) => ({ facts, index })).filter(({ facts, index }) => {
    const query = treeSearch.trim().toLowerCase();
    return !query || `tree ${index + 1}`.includes(query) || facts.predictors.some(name => name.toLowerCase().includes(query));
  }), [analysis.treeFacts, treeSearch]);
  function updateProfile(values: Record<string, string>) {
    previousTrace.current = ensembleTrace; setProfileRevision(value => value + 1); setProfileValues(values);
  }
  function selectTree(index: number) { setFocusedNodeId(undefined); setSelectedTree(index); }
  function exploreTree(index: number) {
    setSelectedTree(index); setView('explore'); setNavigationOpen(false); setFocusedNodeId('root'); setFocusRequest(value => value + 1);
  }
  function selectOccurrence(treeIndex: number, nodeId: string) {
    setView('explore'); setNavigationOpen(false); setSelectedTree(treeIndex); setTreePage(Math.floor(treeIndex / 100));
    setFocusedNodeId(nodeId);
    setFocusRequest(value => value + 1);
  }
  return (
    <section className="workspace" aria-label="Model workspace">
      <div className="workspace-heading">
        <div><p className="eyebrow">MODEL WORKSPACE <span>/</span> OBSERVED STRUCTURE VALIDATED</p><h1 ref={titleRef} tabIndex={-1}>{fileName}</h1><p className="workspace-subtitle">Pega Adaptive Gradient Boosting <span className="version-tag">Export tag: {model.modelVersion}</span></p></div>
        <button className="button button-quiet" onClick={onClose}>Open another <span>↗</span></button>
      </div>
      <p className="preview-notice">Unverified export preview. Pega oracle and live-CDH scoring parity are not established. AI explanations are deferred; model and profile data stay local.</p>
      <details className="model-metadata"><summary>Model metadata and metric definitions</summary>
        <dl>
          <dt>Adapter provenance</dt><dd>{model.modelVersion === '2' ? 'Observed bundled sample-v2 shape' : 'Observed UUID-v4-tagged export structure'}; compatibility and scoring are not Pega-oracle certified. The export tag is preserved, not assumed to be a schema version.</dd>
          <dt>Export update time (UTC)</dt><dd>{model.factoryUpdateTime ? <time dateTime={model.factoryUpdateTime}>{model.factoryUpdateTime}</time> : 'Not available or invalid; see diagnostics.'}</dd>
          <dt>Exported training counts</dt><dd>{model.trainingStats ? `${model.trainingStats.positiveCount.toLocaleString()} positive / ${model.trainingStats.negativeCount.toLocaleString()} negative / ${model.trainingStats.totalCount.toLocaleString()} total` : 'Not supplied'}</dd>
          <dt>Exported successRate / AUC</dt><dd>{model.successRate ?? 'Not supplied'} / {model.auc ?? 'Not supplied'}. Raw training metadata, not a performance or calibration certification.</dd>
          <dt>Structure metrics</dt><dd>Tree/predictor/node counts describe the export, not causal importance. Deepest path includes the root as one level.</dd>
          {analysis.timings && <><dt>Local worker processing</dt><dd data-worker-parse-ms={analysis.timings.parseMs} data-worker-analysis-ms={analysis.timings.analysisMs}>Read/parse/validate: {analysis.timings.parseMs.toFixed(1)} ms; indexing: {analysis.timings.analysisMs.toFixed(1)} ms. These are local diagnostics, not main-thread blocking durations.</dd></>}
        </dl>
      </details>
      {!!result.issues.length && <ValidationReport result={result} />}
      <div className="metrics-row" aria-label="Model structure summary">
        <Metric label="Trees" value={model.trees.length.toLocaleString()} /><Metric label="Predictors" value={analysis.predictors.length.toLocaleString()} />
        <Metric label="Tree nodes" value={result.nodeCount.toLocaleString()} /><Metric label="Deepest path" value={`${result.maxDepth + 1} levels`} />
      </div>
      {ensembleTrace.arithmeticIssue && <p className="error-message" role="alert">{ensembleTrace.arithmeticIssue}</p>}
      <div className="workspace-actions" aria-label="Workspace tasks">
        <button className="button button-quiet" aria-pressed={view === 'explore'} onClick={() => setView('explore')}>Explore trees</button>
        <button className="button button-quiet" aria-pressed={view === 'trace'} onClick={() => setView('trace')}>Trace a profile</button>
      </div>
      <div className="explorer-layout">
        <aside className="tree-index" aria-label="Ensemble and predictor search">
          <button className="mobile-navigation-toggle" aria-expanded={navigationOpen} aria-controls="workspace-navigation" onClick={() => setNavigationOpen(value => !value)}>Find a tree or predictor</button>
          <div id="workspace-navigation" className={`navigation-content${navigationOpen ? ' is-open' : ''}`}>
            <div className="section-label"><span>ENSEMBLE</span><span>{model.trees.length}</span></div>
            <label className="predictor-search-field">Find a tree<input aria-label="Search trees" type="search" value={treeSearch} onChange={event => { setTreeSearch(event.target.value); setTreePage(0); }} placeholder="Tree number or predictor" /></label>
            <ol>{filteredTrees.slice(treePage * 100, (treePage + 1) * 100).map(({ index }) => {
              return <li key={index}><button className={selectedTree === index ? 'tree-row is-selected' : 'tree-row'} onClick={() => exploreTree(index)} aria-current={selectedTree === index ? 'true' : undefined}><span className="tree-number">{String(index + 1).padStart(2, '0')}</span><span className="tree-label">Tree {index + 1}</span><span className="tree-leaves">{analysis.treeFacts[index].leaves} leaves</span></button></li>;
            })}</ol>
            {!filteredTrees.length && <p className="predictor-empty">No matching trees.</p>}
            {filteredTrees.length > 100 && <div className="pagination"><button disabled={treePage === 0} onClick={() => setTreePage(value => value - 1)}>Previous trees</button><span>{treePage + 1} / {Math.ceil(filteredTrees.length / 100)}</span><button disabled={(treePage + 1) * 100 >= filteredTrees.length} onClick={() => setTreePage(value => value + 1)}>Next trees</button></div>}
            <div className="predictor-search">
              <div className="section-label"><span>PREDICTORS</span><span>{analysis.predictors.length}</span></div>
              <label className="predictor-search-field">Find a predictor<input type="search" aria-label="Search predictors" value={predictorSearch} onChange={event => { setPredictorSearch(event.target.value); setPredictorPage(0); }} placeholder="Search by name" /></label>
              <div className="predictor-groups" aria-label="Predictor split occurrences">
                {filteredPredictors.slice(predictorPage * 20, (predictorPage + 1) * 20).map(group => <PredictorOccurrences key={group.feature} group={group} client={client} onSelect={selectOccurrence} />)}
                {!filteredPredictors.length && <p className="predictor-empty">No matching predictors.</p>}
              </div>
              {filteredPredictors.length > 20 && <div className="pagination">
                <button disabled={predictorPage === 0} onClick={() => setPredictorPage(value => value - 1)}>Previous predictors</button>
                <span>{predictorPage + 1} / {Math.ceil(filteredPredictors.length / 20)}</span>
                <button disabled={(predictorPage + 1) * 20 >= filteredPredictors.length} onClick={() => setPredictorPage(value => value + 1)}>Next predictors</button>
              </div>}
            </div>
          </div>
        </aside>
        <section className="tree-inspector" aria-labelledby="tree-title">
          <div className="inspector-topline"><span>STRUCTURE / TREE {selectedTree + 1}</span><span>INTERACTIVE TREE MAP</span></div><h2 id="tree-title">Tree {selectedTree + 1}</h2>
          <div className="tree-facts">
            <div><span>Nodes in tree</span><b>{facts.nodeCount}</b></div><div><span>Leaves</span><b>{facts.leaves}</b></div>
            <div><span>Exported sampleCount</span><b>{tree.sampleCount.toLocaleString()}</b></div><div><span>Serialized leaf-score range</span><b>{formatScore(facts.minimum)} to {formatScore(facts.maximum)}</b></div>
          </div>
          <p className="diagram-guidance">Tree {selectedTree + 1} is one sequence of questions. An illustrative profile reaches one of its {facts.leaves} leaves and selects one additive contribution.</p>
          <div hidden={view !== 'explore'}>
            <TreeDiagram key={selectedTree} tree={tree} treeNumber={selectedTree + 1} tracePath={stage.path} focusedNodeId={focusedNodeId} focusRequest={focusRequest} />
          </div>
          <div hidden={view !== 'trace'}>
            <ProfileTracePanel features={analysis.features} values={profileValues} stage={stage} runningScore={ensembleTrace.runningScores[selectedTree]}
              ensembleComplete={ensembleTrace.complete} ensembleRawScore={ensembleTrace.rawScore} ensemblePropensity={ensembleTrace.propensity}
              stages={ensembleTrace.stages} runningScores={ensembleTrace.runningScores} changedTrees={changedTrees} profileRevision={profileRevision} arithmeticIssue={ensembleTrace.arithmeticIssue}
              treeIndex={selectedTree} treeCount={model.trees.length} search={profileSearch} onSearchChange={setProfileSearch}
              onValueChange={(feature, value) => updateProfile({ ...profileValues, [feature]: value })} onTreeChange={selectTree}
              onRegenerate={() => { const next = profileVariant + 1; setProfileVariant(next); updateProfile(createIllustrativeProfile(analysis.features, next)); }}
              onReset={() => { setProfileVariant(0); updateProfile(createIllustrativeProfile(analysis.features)); }} />
          </div>
        </section>
      </div>
    </section>
  );
}

const PredictorOccurrences = memo(function PredictorOccurrences({ group, client, onSelect }: {
  group: PredictorGroup; client: ModelWorkerClient; onSelect: (tree: number, node: string) => void;
}) {
  const [entries, setEntries] = useState<PredictorOccurrence[]>(group.initialOccurrences);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  async function page(next: number) {
    const request = ++generation.current;
    setBusy(true); setError('');
    try {
      const results = await client.getOccurrences(group.feature, next);
      if (request === generation.current) { setEntries(results); setOffset(next); }
    } catch (cause) {
      if (request === generation.current) setError(cause instanceof Error ? cause.message : 'Predictor navigation failed. Retry.');
    } finally { if (request === generation.current) setBusy(false); }
  }
  return (
    <details className="predictor-group">
      <summary><span title={group.feature}>{group.feature}</span><small>{group.count} splits</small></summary>
      <ul>{entries.map(entry => <li key={`${entry.treeIndex}-${entry.nodeId}`}><button aria-label={`Tree ${entry.treeIndex + 1}, ${entry.nodeId}, ${entry.split}`} title={entry.split} onClick={() => onSelect(entry.treeIndex, entry.nodeId)}>Tree {entry.treeIndex + 1}<span>{entry.nodeId}</span></button></li>)}</ul>
      {group.count > OCCURRENCE_PAGE_SIZE && <div className="pagination">
        <button disabled={busy || offset === 0} onClick={() => void page(offset - OCCURRENCE_PAGE_SIZE)}>Previous splits</button>
        <span>{offset + 1}–{Math.min(offset + entries.length, group.count)} of {group.count}</span>
        <button disabled={busy || offset + OCCURRENCE_PAGE_SIZE >= group.count} onClick={() => void page(offset + OCCURRENCE_PAGE_SIZE)}>Next splits</button>
      </div>}
      {busy && <p role="status">Loading occurrences…</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
});
function ValidationReport({ result }: { result: ImportResult }) {
  return <details className="validation-report" open={!result.model}><summary>Validation report ({result.issues.length} diagnostics)</summary><ul>{result.issues.map((issue, index) => <li key={index}><b>{issue.severity}</b> <code>{issue.path}</code>: {issue.message}</li>)}</ul></details>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><b>{value}</b></div>; }
function formatScore(value: number): string { return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`; }
