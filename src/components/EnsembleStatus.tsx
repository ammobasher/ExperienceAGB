import { useMemo, useState } from 'react';
import type { StageTrace } from '../domain/profileTrace';

export function TraceIssues({ stages, onInspect, onEdit }: {
  stages: StageTrace[]; onInspect: (tree: number) => void; onEdit: (feature: string) => void;
}) {
  const [page, setPage] = useState(0);
  const blocked = useMemo(() => stages.filter(stage => !stage.complete), [stages]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(blocked.length / 20) - 1));
  if (!blocked.length) return null;
  return <section className="trace-issues" aria-label="Incomplete trace guidance">
    <p role="alert">{blocked.length} tree {blocked.length === 1 ? 'route is' : 'routes are'} incomplete. No ensemble preview is available.</p>
    <ul>{blocked.slice(currentPage * 20, (currentPage + 1) * 20).map(stage => <li key={stage.treeIndex}>
      <p><b>Tree {stage.treeIndex + 1}: {stage.issue?.feature}</b> — {stage.issue?.message}</p>
      <button onClick={() => onInspect(stage.treeIndex)}>Inspect incomplete Tree {stage.treeIndex + 1}: {stage.issue?.feature}</button>
      {stage.issue && <button onClick={() => onEdit(stage.issue!.feature)}>Edit blocked feature {stage.issue.feature}</button>}
    </li>)}</ul>
    {blocked.length > 20 && <div className="pagination"><button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous issues</button><span>{currentPage + 1} / {Math.ceil(blocked.length / 20)}</span><button disabled={(currentPage + 1) * 20 >= blocked.length} onClick={() => setPage(currentPage + 1)}>Next issues</button></div>}
  </section>;
}

export function EnsembleStatus({ stages, runningScores, onInspect }: {
  stages: StageTrace[]; runningScores: Array<number | undefined>; onInspect: (tree: number) => void;
}) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  return <details className="ensemble-status" open={open}>
    <summary onClick={event => { event.preventDefault(); setOpen(value => !value); }}>Ensemble route status ({stages.filter(stage => stage.complete).length}/{stages.length} leaves reached)</summary>
    {open && <>
      <div className="status-table-scroll"><table><caption>Illustrative tree contributions, not causal effects</caption><thead><tr><th scope="col">Tree</th><th scope="col">Route</th><th scope="col">Leaf contribution</th><th scope="col">Running raw score</th></tr></thead><tbody>
        {stages.slice(page * 20, (page + 1) * 20).map(stage => <tr key={stage.treeIndex}><th scope="row"><button onClick={() => onInspect(stage.treeIndex)}>Inspect Tree {stage.treeIndex + 1}</button></th><td>{stage.complete ? stage.path.at(-1) : stage.issue?.message}</td><td>{stage.leaf?.score.toFixed(4) ?? 'Unavailable'}</td><td>{runningScores[stage.treeIndex]?.toFixed(4) ?? 'Unavailable'}</td></tr>)}
      </tbody></table></div>
      {stages.length > 20 && <div className="pagination"><button disabled={!page} onClick={() => setPage(value => value - 1)}>Previous stages</button><span>{page + 1} / {Math.ceil(stages.length / 20)}</span><button disabled={(page + 1) * 20 >= stages.length} onClick={() => setPage(value => value + 1)}>Next stages</button></div>}
    </>}
  </details>;
}
