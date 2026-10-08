import type { ProfileFeature, StageTrace } from '../domain/profileTrace';
import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { getProfileValueState } from '../domain/profileTrace';
import { EnsembleStatus, TraceIssues } from './EnsembleStatus';

interface Props {
  features: ProfileFeature[];
  values: Record<string, string>;
  stage: StageTrace;
  runningScore?: number;
  ensembleComplete: boolean;
  ensembleRawScore?: number;
  ensemblePropensity?: number;
  treeIndex: number;
  treeCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  onValueChange: (feature: string, value: string) => void;
  onTreeChange: (index: number) => void;
  onRegenerate: () => void;
  onReset: () => void;
  stages?: StageTrace[];
  runningScores?: Array<number | undefined>;
  changedTrees?: number[];
  profileRevision?: number;
  arithmeticIssue?: string;
}

export default function ProfileTracePanel({
  features,
  values,
  stage,
  runningScore,
  ensembleComplete,
  ensembleRawScore,
  ensemblePropensity,
  treeIndex,
  treeCount,
  search,
  onSearchChange,
  onValueChange,
  onTreeChange,
  onRegenerate,
  onReset,
  stages,
  runningScores,
  changedTrees = [],
  profileRevision = 0,
  arithmeticIssue,
}: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [featurePage, setFeaturePage] = useState(0);
  const filteredFeatures = useMemo(() => features.filter(feature => feature.name.toLowerCase().includes(search.trim().toLowerCase())), [features, search]);
  const visibleFeatures = filteredFeatures.slice(featurePage * 25, (featurePage + 1) * 25);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const focusFeature = useRef<string>();
  const [featureFocusRequest, setFeatureFocusRequest] = useState(0);
  useEffect(() => { setFeaturePage(0); }, [search]);
  useEffect(() => {
    if (!focusFeature.current || !editorOpen) return;
    const index = filteredFeatures.findIndex(feature => feature.name === focusFeature.current);
    if (index >= 0 && Math.floor(index / 25) !== featurePage) { setFeaturePage(Math.floor(index / 25)); return; }
    const input = inputRefs.current.get(focusFeature.current);
    if (input) { input.focus(); input.scrollIntoView?.({ block: 'nearest' }); focusFeature.current = undefined; }
  }, [editorOpen, search, featurePage, filteredFeatures, featureFocusRequest]);
  const previewPath = stage.path.length > 1
    ? stage.path.slice(1).map((path) => path.endsWith('.L') ? 'Left' : 'Right').join(' / ')
    : 'Root leaf';

  return (
    <section className="profile-trace" aria-label="Illustrative profile route preview">
      <div className="profile-trace-header">
        <div><span className="trace-heading">PROFILE TRACE</span><span className="synthetic-badge">ILLUSTRATIVE</span></div>
        <span className="unverified-badge">ROUTE PREVIEW · UNVERIFIED</span>
      </div>
      <p className="synthetic-explanation">This generated profile uses values found in the model's splits. It does not represent a real person or population.</p>
      {!!profileRevision && <p role="status">Profile updated: {changedTrees.length} tree routes or contributions changed. {changedTrees.slice(0, 20).map(index => <button className="changed-tree-link" key={index} onClick={() => onTreeChange(index)}>Inspect changed Tree {index + 1}</button>)}{changedTrees.length > 20 && 'Showing the first 20 changes; inspect all stages below.'}</p>}

      <details className="profile-editor" open={editorOpen}>
        <summary onClick={event => { event.preventDefault(); setEditorOpen(value => !value); }}>Edit illustrative profile <span>{features.length} features</span></summary>
        {editorOpen && <>
        <div className="profile-editor-tools">
          <label className="profile-search">Filter features<input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search feature names" /></label>
          <div className="profile-actions"><button onClick={onRegenerate}>New illustration</button><button onClick={onReset}>Reset values</button></div>
        </div>
        <div className="profile-fields">
          {visibleFeatures.map((feature, index) => {
            const value = values[feature.name] ?? '';
            const state = getProfileValueState(feature, value);
            const listId = `profile-categories-${index}`;
            return (
              <label className="profile-field" key={feature.name}>
                <span className="profile-feature-name" title={feature.name}>{feature.name}</span>
                <input
                  ref={element => { if (element) inputRefs.current.set(feature.name, element); else inputRefs.current.delete(feature.name); }}
                  aria-label={`Illustrative ${feature.name}`}
                  aria-invalid={state === 'Invalid number' || state === 'Unknown category' || state === 'Unsupported'}
                  aria-describedby={`${listId}-state`}
                  autoComplete="off"
                  inputMode={feature.kind === 'number' ? 'decimal' : 'text'}
                  list={feature.kind === 'category' ? listId : undefined}
                  placeholder={feature.kind === 'unsupported' ? 'Unsupported split' : 'Blank means missing'}
                  value={value}
                  onChange={(event) => onValueChange(feature.name, event.target.value)}
                />
                {feature.kind === 'category' && <datalist id={listId}>{feature.categories.slice(0, 50).map((category) => <option key={category} value={category} />)}</datalist>}
                <span id={`${listId}-state`} className={`profile-value-state state-${state.toLowerCase().replaceAll(' ', '-')}`}>{state}</span>
              </label>
            );
          })}
          {filteredFeatures.length === 0 && <p className="profile-empty">No matching features.</p>}
        </div>
        {filteredFeatures.length > 25 && <div className="pagination">
          <button disabled={featurePage === 0} onClick={() => setFeaturePage(value => value - 1)}>Previous features</button>
          <span>{featurePage * 25 + 1}–{Math.min((featurePage + 1) * 25, filteredFeatures.length)} of {filteredFeatures.length}</span>
          <button disabled={(featurePage + 1) * 25 >= filteredFeatures.length} onClick={() => setFeaturePage(value => value + 1)}>Next features</button>
        </div>}
        <p className="diagram-guidance">Category suggestions show up to 50 exported values. Enter an exact value or leave the field empty to mark it missing.</p>
        </>}
      </details>
      <TraceIssues stages={stages ?? [stage]} onInspect={onTreeChange} onEdit={feature => { focusFeature.current = feature; setFeatureFocusRequest(value => value + 1); setEditorOpen(true); onSearchChange(feature); }} />

      <div className="stage-preview">
        <div className="stage-preview-title"><span>STAGE {treeIndex + 1} <i>/</i> {treeCount}</span><span>{stage.complete ? 'LEAF REACHED' : 'ROUTE INCOMPLETE'}</span></div>
        <div className="stage-preview-result">
          {stage.complete ? (
            <><div><span>Preview path</span><b>{previewPath}</b></div><div><span>Stage contribution</span><b className={stage.leaf!.score < 0 ? 'score-negative' : 'score-positive'}>{formatScore(stage.leaf!.score)}</b></div><div><span>Running raw score through this tree</span><b>{runningScore === undefined ? 'Unavailable: earlier route incomplete' : formatScore(runningScore)}</b></div></>
          ) : (
            <div className="stage-issue"><span>{stage.issue?.feature ?? 'Route'}</span><b>{stage.issue?.message ?? 'This route cannot be resolved.'}</b><span>Resolved route prefix</span><b>{stage.path.length > 1 ? previewPath : 'Root; no branch resolved'}</b></div>
          )}
        </div>
        <div className="ensemble-score" aria-live="polite">
          <div><span>Ensemble raw score</span><b>{ensembleComplete ? formatScore(ensembleRawScore!) : arithmeticIssue ? 'Arithmetic unresolved' : 'Incomplete routes'}</b></div>
          <div><span>Unverified propensity preview</span><b>{ensembleComplete ? formatPropensity(ensemblePropensity!) : arithmeticIssue ? 'Arithmetic unresolved' : 'Incomplete routes'}</b></div>
          <p>Pega oracle parity has not been verified. This is an illustrative exported-score preview, not a final or live-CDH propensity. {ensembleComplete ? 'Preview arithmetic: sigmoid(sum of selected leaf scores), following the public pdstools scorer; no extra learning-rate multiplier.' : 'Complete every supported tree route to calculate a preview.'}</p>
        </div>
        {!!stage.steps?.length && <details className="route-evidence"><summary>Branch decisions ({stage.steps.length})</summary><ol>{stage.steps.map(step => <li key={step.nodeId}><b>{step.question}</b><p>Illustrative value: <code>{step.value === '' ? '(missing)' : JSON.stringify(step.value)}</code> — {step.branch}</p></li>)}</ol></details>}
        {stages && runningScores && <EnsembleStatus stages={stages} runningScores={runningScores} onInspect={onTreeChange} />}
        <div className="stage-controls">
          <button onClick={() => onTreeChange(treeIndex - 1)} disabled={treeIndex === 0}>← Previous tree</button>
          <span aria-live="polite">Tree {treeIndex + 1} of {treeCount}</span>
          <button onClick={() => onTreeChange(treeIndex + 1)} disabled={treeIndex >= treeCount - 1}>Next tree →</button>
        </div>
      </div>
      <p className="trace-caveat">Each tree starts at its own root and independently evaluates the same profile. Next Tree changes the stage being inspected; it does not continue from the previous tree's leaf. Contributions are additive raw scores, not causal impact.</p>
    </section>
  );
}

function formatScore(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`;
}

function formatPropensity(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}