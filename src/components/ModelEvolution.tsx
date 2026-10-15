import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IMPORT_LIMITS } from '../domain/importModel';
import { compareSnapshots, EVOLUTION_METRICS, formatEvolutionValue, metricSegments, orderSnapshots, parseManualSnapshotTime } from '../domain/modelEvolution';
import type { EvolutionMetric, EvolutionSnapshot } from '../domain/modelEvolution';
import type { ValidationIssue } from '../domain/agb';
import { ModelWorkerClient } from '../services/ModelWorkerClient';
import { Term } from './TechnicalTerms';

const PAGE_SIZE = 10;
const metricKeys = Object.keys(EVOLUTION_METRICS) as EvolutionMetric[];
interface ImportNotice { name: string; message: string; issues?: ValidationIssue[]; error?: boolean; duplicateId?: string; keptSeparately?: boolean }

export default function ModelEvolution() {
  const client = useRef(new ModelWorkerClient()).current;
  const controllerRef = useRef<AbortController>();
  const mounted = useRef(true);
  const nextId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [snapshots, setSnapshots] = useState<EvolutionSnapshot[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [notices, setNotices] = useState<ImportNotice[]>([]);
  const [snapshotPage, setSnapshotPage] = useState(0);
  const [reportPage, setReportPage] = useState(0);
  const chronology = useMemo(() => orderSnapshots(snapshots), [snapshots]);
  const ordered = [...chronology.dated, ...chronology.undated];
  const visiblePage = Math.min(snapshotPage, Math.max(0, Math.ceil(ordered.length / PAGE_SIZE) - 1));
  const ready = confirmed && chronology.dated.length >= 2 && !chronology.duplicateTimes.length;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controllerRef.current?.abort(); client.dispose(); };
  }, [client]);

  async function importFiles(files: File[]) {
    if (!files.length) return;
    if (!confirmed) { setStatus('Confirm that these exports belong to the same model before importing.'); return; }
    if (controllerRef.current) { setStatus('An import is already running. Cancel it or wait before adding files.'); return; }
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true); setNotices([]); setReportPage(0); setStatus(`Preparing ${files.length} snapshot files for local analysis...`);
    const seen = new Map(snapshots.flatMap(snapshot => snapshot.digest ? [[snapshot.digest, snapshot.id] as const] : []));
    let added = 0, rejected = 0, duplicates = 0;
    const report = (notice: ImportNotice) => { if (mounted.current) setNotices(current => [...current, notice]); };
    try {
      for (let index = 0; index < files.length; index++) {
        if (controller.signal.aborted) break;
        const file = files[index];
        if (!file.name.toLowerCase().endsWith('.json') || file.size > IMPORT_LIMITS.maxFileSizeBytes) {
          rejected++;
          report({ name: file.name, message: 'Rejected: choose a .json export within the 25 MB per-file limit.', error: true });
          continue;
        }
        try {
          setStatus(`${index + 1} of ${files.length}: reading ${file.name} locally...`);
          const result = await client.readEvolution(file, controller.signal, message => setStatus(`${index + 1} of ${files.length}: ${file.name} - ${message}`));
          if (controller.signal.aborted) break;
          if (!result.summary) {
            rejected++;
            report({ name: file.name, message: 'Rejected: the export did not pass validation.', issues: result.issues, error: true });
          } else if (result.summary.digest && seen.has(result.summary.digest)) {
            duplicates++;
            report({ name: file.name, message: 'Duplicate skipped: these exact file bytes have already been imported. No extra snapshot was added.', duplicateId: seen.get(result.summary.digest) });
          } else {
            const summary = result.summary;
            const snapshot: EvolutionSnapshot = {
              ...summary, id: String(++nextId.current), name: file.name,
              time: summary.exportedAt, timeSource: summary.exportedAt ? 'export' : 'missing',
            };
            if (summary.digest) seen.set(summary.digest, snapshot.id);
            setSnapshots(current => [...current, snapshot]); added++;
            report({ name: file.name, message: result.issues.length ? 'Imported with validation warnings.' : 'Imported locally.', issues: result.issues });
          }
        } catch (cause) {
          if (controller.signal.aborted) break;
          rejected++;
          report({ name: file.name, message: cause instanceof Error ? cause.message : 'The local snapshot import failed. Retry the file.', error: true });
        }
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
        setStatus(controller.signal.aborted
          ? `Cancelled. Kept ${added} newly imported snapshots and all earlier snapshots; files not completed were not added.`
          : `Import complete: ${added} added, ${duplicates} exact duplicates skipped, ${rejected} rejected.`);
      }
      controllerRef.current = undefined;
    }
  }
  function changeTime(id: string, time: string | undefined, source: EvolutionSnapshot['timeSource']) {
    setSnapshots(current => current.map(snapshot => snapshot.id === id ? { ...snapshot, time, timeSource: source } : snapshot));
  }
  function clear() {
    setSnapshots([]); setNotices([]); setConfirmed(false); setSnapshotPage(0); setReportPage(0);
    setStatus('Comparison cleared. No files were changed.'); setLabel('');
  }
  function keepDuplicate(notice: ImportNotice, noticeIndex: number) {
    const original = snapshots.find(snapshot => snapshot.id === notice.duplicateId);
    if (!original) { setStatus('The original snapshot was removed. Import the file again to add it.'); return; }
    const snapshot: EvolutionSnapshot = { ...original, id: String(++nextId.current), name: notice.name, time: undefined, timeSource: 'missing' };
    setSnapshots(current => [...current, snapshot]);
    setNotices(current => current.map((entry, index) => index === noticeIndex ? { ...entry, keptSeparately: true } : entry));
    setStatus(`Kept ${notice.name} as a separate snapshot. Supply its actual UTC time before it can appear in trends.`);
  }

  return <section className="model-evolution" aria-label="Model evolution">
    <h2>Model evolution{label.trim() ? `: ${label.trim()}` : ''}</h2>
    <p>Import exports of the same model from different times to compare structure and available training metadata. Files are analyzed sequentially in a local worker; only summaries are retained, not additional forests. Nothing in this comparison is uploaded or added to the open model&apos;s AI request.</p>
    <p>Snapshots are held in memory only. Switching workspace views preserves them; closing the model/comparison, refreshing or leaving the page clears them. The open export is not automatically included: select its file too if it belongs in this series.</p>
    <label className="evolution-label">Snapshot series name (optional)<input value={label} maxLength={200} onChange={event => setLabel(event.target.value)} /></label>
    <p className="preview-notice">The accepted export contains no reliable model identity. Export tags, filenames and matching predictors cannot establish that these are the same model.</p>
    <label className="evolution-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> I confirm these snapshots belong to the same model.</label>
    <div className="workspace-actions">
      <button className="button button-primary" disabled={!confirmed || busy} onClick={() => inputRef.current?.click()}>Add snapshot files</button>
      <input ref={inputRef} type="file" aria-label="Snapshot export files" accept=".json,application/json" multiple hidden onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void importFiles(files); }} />
      {busy && <button className="button button-quiet" onClick={() => { setStatus('Cancelling the current snapshot import...'); controllerRef.current?.abort(); }}>Cancel snapshot import</button>}
      {!!snapshots.length && <button className="button button-quiet" disabled={busy} onClick={clear}>Clear comparison</button>}
    </div>
    <p role="status">{status || 'No snapshot files imported yet.'}</p>
    {!!notices.length && <details className="evolution-report" open>
      <summary>Last import report ({notices.length} files)</summary>
      <ul>{notices.slice(reportPage * PAGE_SIZE, (reportPage + 1) * PAGE_SIZE).map((notice, index) => <li key={index} className={notice.error ? 'error-message' : undefined}>
        <b>{notice.name}</b>: {notice.message}
        {notice.duplicateId && !notice.keptSeparately && <p>Identical bytes can also represent an unchanged model observed at another time. Keep separately only for a distinct observation, then supply its accurate UTC time. <button className="button button-quiet" disabled={busy || !confirmed} onClick={() => keepDuplicate(notice, reportPage * PAGE_SIZE + index)}>Keep as separate snapshot</button></p>}
        {notice.keptSeparately && <p>Explicitly kept as a separate snapshot without a guessed date. Set its UTC time in the membership table.</p>}
        {!!notice.issues?.length && <details><summary>Validation diagnostics ({notice.issues.length})</summary><ul>{notice.issues.map((issue, issueIndex) => <li key={issueIndex}><b>{issue.severity}</b> <code>{issue.path}</code>: {issue.message}</li>)}</ul></details>}
      </li>)}</ul>
      <Pages label="Import report" page={reportPage} total={notices.length} onPage={setReportPage} />
    </details>}
    {!snapshots.length ? <p className="evolution-empty">Add at least two dated snapshots to display trends. Missing metrics remain unavailable, never zero. Structural changes do not by themselves demonstrate improved performance.</p> : <>
      <h3>Snapshot dates and membership</h3>
      <p>{snapshots.length} snapshots retained; {chronology.dated.length} dated; {chronology.undated.length} excluded from trends until a valid UTC time is supplied. Imported timestamps come from factoryUpdateTime, not filenames or file-modification times. Manual time fields mean UTC, not your device&apos;s local time.</p>
      <Term term="timestamp" /><Term term="exportTag" />
      {!!chronology.duplicateTimes.length && <p className="error-message" role="alert">Several snapshots have the same UTC time: {chronology.duplicateTimes.join(', ')}. Charts and chronological insights are paused; remove duplicates or assign accurate distinct times. No ordering has been guessed.</p>}
      <div className="evolution-table-scroll" role="region" aria-label="Snapshot membership and dates" tabIndex={0}>
        <table className="evolution-table"><caption>Imported snapshot dates, provenance and membership</caption><thead><tr><th scope="col">File</th><th scope="col">Time and source (UTC)</th><th scope="col">Export tag</th><th scope="col">Actions</th></tr></thead>
          <tbody>{ordered.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE).map(snapshot => <tr key={snapshot.id}>
            <th scope="row">{snapshot.name}</th>
            <td><p>{snapshot.time ? <time dateTime={snapshot.time}>{snapshot.time}</time> : 'Time not available'} ({snapshot.timeSource})</p><SnapshotTime snapshot={snapshot} disabled={busy} onChange={changeTime} /></td>
            <td>{snapshot.exportTag}</td><td><button className="button button-quiet" disabled={busy} aria-label={`Remove ${snapshot.name}`} onClick={() => { setSnapshots(current => current.filter(item => item.id !== snapshot.id)); setStatus(`Removed ${snapshot.name} from this comparison. No file was changed.`); }}>Remove</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <Pages label="Snapshots" page={visiblePage} total={snapshots.length} onPage={setSnapshotPage} />
      {!ready && <p className="evolution-empty">{!confirmed ? 'Confirm same-model membership to enable comparisons.' : chronology.duplicateTimes.length ? 'Resolve the duplicate snapshot times above to enable charts.' : 'At least two snapshots with distinct UTC times are needed for chronological charts and insights.'}</p>}
      {ready && <>
        <div className="evolution-charts">
          <TrendChart snapshots={chronology.dated} group="structure" initial="trees" title="Structure over time" />
          <TrendChart snapshots={chronology.dated} group="evaluation" initial="auc" title="Exported evaluation metrics" />
          <TrendChart snapshots={chronology.dated} group="training" initial="totalCount" title="Training counts over time" />
          <TrendChart snapshots={chronology.dated} group="gain" initial="totalGain" title="Stored gain over time" />
        </div>
        <EvolutionInsights snapshots={chronology.dated} />
      </>}
      <MetricTable snapshots={ordered} />
    </>}
    <p className="preview-notice">Comparison is descriptive, not a drift detector, causal analysis, scoring-parity test or live-performance certification. Training/evaluation windows and populations may differ. Missing metadata is not reconstructed.</p>
  </section>;
}

function SnapshotTime({ snapshot, disabled, onChange }: { snapshot: EvolutionSnapshot; disabled: boolean; onChange: (id: string, time: string | undefined, source: EvolutionSnapshot['timeSource']) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(snapshot.time?.slice(0, -1) ?? '');
  const [error, setError] = useState('');
  useEffect(() => { setDraft(snapshot.time?.slice(0, -1) ?? ''); setError(''); }, [snapshot.time]);
  function save() {
    const time = parseManualSnapshotTime(draft);
    if (!time) { setError('Enter a valid UTC date and time. Invalid calendar dates are not accepted.'); return; }
    setError(''); onChange(snapshot.id, time, 'manual');
  }
  return <div className="snapshot-time">
    <label htmlFor={id}>UTC time for {snapshot.name}</label>
    <input id={id} type="datetime-local" step="0.001" value={draft} disabled={disabled} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setDraft(event.target.value); setError(''); }} />
    <button className="button button-quiet" disabled={disabled} onClick={save}>Apply UTC time</button>
    {snapshot.timeSource === 'manual' && <button className="button button-quiet" disabled={disabled} onClick={() => onChange(snapshot.id, snapshot.exportedAt, snapshot.exportedAt ? 'export' : 'missing')}>{snapshot.exportedAt ? 'Restore export time' : 'Clear manual time'}</button>}
    {error && <p id={`${id}-error`} role="alert" className="error-message">{error}</p>}
  </div>;
}

function TrendChart({ snapshots, group, initial, title }: { snapshots: EvolutionSnapshot[]; group: 'structure' | 'evaluation' | 'training' | 'gain'; initial: EvolutionMetric; title: string }) {
  const [metric, setMetric] = useState(initial);
  const metrics = metricKeys.filter(key => EVOLUTION_METRICS[key].group === group);
  const segments = metricSegments(snapshots, metric), count = segments.reduce((sum, segment) => sum + segment.length, 0);
  const unit = EVOLUTION_METRICS[metric].unit;
  const absolute = unit === 'count' || unit === 'gain';
  const maximum = absolute ? segments.reduce((max, segment) => segment.reduce((value, point) => Math.max(value, point.value), max), 0) || 1 : 1;
  const firstTime = Date.parse(snapshots[0].time!), lastTime = Date.parse(snapshots.at(-1)!.time!);
  const x = (snapshot: EvolutionSnapshot) => 72 + (Date.parse(snapshot.time!) - firstTime) / (lastTime - firstTime) * 388;
  const y = (value: number) => 164 - value / maximum * 140;
  const label = EVOLUTION_METRICS[metric].label;
  const tick = (value: number) => formatEvolutionValue(metric, value);
  return <section className="evolution-chart" aria-label={title}>
    <h3>{title}</h3>
    <label>Chart metric<select aria-label={`${title} metric`} value={metric} onChange={event => { const key = metrics.find(key => key === event.target.value); if (key) setMetric(key); }}>
      {metrics.map(key => <option key={key} value={key}>{EVOLUTION_METRICS[key].label}</option>)}
    </select></label>
    {group === 'evaluation' && <><Term term="auc" /><Term term="successRate" /></>}
    {group === 'training' && <Term term="training" />}
    {group === 'gain' && <p>Stored training split gain, not SHAP, live predictive value or drift. Missing internal gains leave gaps independently of other charts.</p>}
    {!count ? <p>No dated snapshots supply this metric. It is not treated as zero.</p> : <figure>
      <div className="trend-scroll" tabIndex={0} role="region" aria-label={`${label} chart scroll area`}>
        <svg viewBox="0 0 480 216" role="img" aria-label={`${label} over UTC time; ${count} of ${snapshots.length} dated snapshots have values. Exact values are in the snapshot metrics table.`}>
          <line x1={72} x2={460} y1={164} y2={164} className="trend-axis" />
          {[0, .5, 1].map(ratio => <g key={ratio}><line x1={72} x2={460} y1={y(ratio * maximum)} y2={y(ratio * maximum)} className="trend-grid" /><text x={64} y={y(ratio * maximum) + 4} textAnchor="end">{tick(ratio * maximum)}</text></g>)}
          {segments.map((segment, index) => <g key={index}>
            <path className="trend-line" d={segment.map((point, pointIndex) => `${pointIndex ? 'L' : 'M'}${x(point.snapshot)},${y(point.value)}`).join(' ')} />
            {segment.map(point => <circle key={point.snapshot.id} cx={x(point.snapshot)} cy={y(point.value)} r={4} className="trend-point"><title>{point.snapshot.name}: {point.snapshot.time}; {formatEvolutionValue(metric, point.value)}</title></circle>)}
          </g>)}
          <text x={72} y={190}>{snapshots[0].time!.slice(0, 10)}</text><text x={460} y={190} textAnchor="end">{snapshots.at(-1)!.time!.slice(0, 10)}</text>
          <text x={266} y={210} textAnchor="middle">UTC time (actual elapsed spacing)</text>
        </svg>
      </div>
      <figcaption>{count} of {snapshots.length} dated snapshots supply {label.toLowerCase()}. Missing values break the line; they are not zero or interpolated. {absolute ? 'Value scale starts at zero.' : 'Proportion scale is fixed from zero to one (0-100%).'} Exact UTC times and values are in the tables below.</figcaption>
    </figure>}
  </section>;
}

function EvolutionInsights({ snapshots }: { snapshots: EvolutionSnapshot[] }) {
  const before = snapshots[0], after = snapshots.at(-1)!;
  const comparison = compareSnapshots(before, after);
  return <section className="evolution-insights" aria-label="Evolution insights">
    <h3>Earliest-to-latest insights</h3>
    <p>Comparing {before.name} ({before.time}) with {after.name} ({after.time}). These changes describe dated exports, not a demonstrated improvement. Undated snapshots are excluded.</p>
    <div className="evolution-table-scroll" role="region" aria-label="Metric changes" tabIndex={0}>
      <table className="evolution-table"><caption>Changes between earliest and latest dated snapshots</caption><thead><tr><th scope="col">Metric</th><th scope="col">Earliest</th><th scope="col">Latest</th><th scope="col">Change</th></tr></thead><tbody>
        {comparison.changes.map(change => <tr key={change.metric}><th scope="row">{EVOLUTION_METRICS[change.metric].label}</th><td>{formatEvolutionValue(change.metric, change.before)}</td><td>{formatEvolutionValue(change.metric, change.after)}</td><td>
          {change.delta === null ? 'Not available at both endpoints' : `${change.delta >= 0 ? '+' : ''}${EVOLUTION_METRICS[change.metric].unit === 'percentage' ? `${(change.delta * 100).toFixed(2)} percentage points` : formatEvolutionValue(change.metric, change.delta)}`}
        </td></tr>)}
      </tbody></table>
    </div>
    <PredictorChanges label="Added predictors" names={comparison.added} />
    <PredictorChanges label="Removed predictors" names={comparison.removed} />
    <p>Predictor additions/removals use exact, case-sensitive names. Frequency, causality, stability and live drift are not inferred from these counts.</p>
    <StructuralChanges key={`${before.id}:${after.id}`} comparison={comparison} />
  </section>;
}

function StructuralChanges({ comparison }: { comparison: ReturnType<typeof compareSnapshots> }) {
  const [page, setPage] = useState(0);
  const [namespacePage, setNamespacePage] = useState(0);
  const [thresholdPage, setThresholdPage] = useState(0);
  const [membershipPage, setMembershipPage] = useState(0);
  if (!comparison.auditAvailable) return <p>Detailed structural summaries are unavailable at one or both endpoints. Reimport the snapshots to compute them.</p>;
  const share = (value: number | null) => value === null ? 'Not available' : `${String(value * 100)}%`;
  return <section aria-label="Structural evolution details">
    <h4>Which shared predictors changed gain share or rank?</h4>
    <p>Ranks use complete positive total gain and shared ranks for ties. Added/removed predictors are listed separately. A share or rank change is not evidence of drift, causality or changed live performance.</p>
    <div className="evolution-table-scroll" tabIndex={0} role="region" aria-label="Predictor gain movers"><table className="evolution-table"><caption>Shared predictor gain-share changes</caption><thead><tr><th scope="col">Predictor</th><th scope="col">Earliest share</th><th scope="col">Latest share</th><th scope="col">Change (percentage points)</th><th scope="col">Earliest / latest rank</th></tr></thead><tbody>{comparison.gainMovers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(row => <tr key={row.feature}><th scope="row">{row.feature}</th><td>{share(row.before)}</td><td>{share(row.after)}</td><td>{row.delta === null ? 'Not available' : String(row.delta * 100)}</td><td>{row.rankBefore ?? 'Not available'} / {row.rankAfter ?? 'Not available'}</td></tr>)}</tbody></table></div>
    <Pages label="Gain movers" page={page} total={comparison.gainMovers.length} onPage={setPage} />
    <div className="evolution-table-scroll" tabIndex={0} role="region" aria-label="Namespace composition changes"><table className="evolution-table"><caption>Literal namespace gain composition</caption><thead><tr><th scope="col">Namespace</th><th scope="col">Earliest share</th><th scope="col">Latest share</th></tr></thead><tbody>{comparison.namespaceChanges.slice(namespacePage * PAGE_SIZE, (namespacePage + 1) * PAGE_SIZE).map(row => <tr key={row.namespace}><th scope="row">{row.namespace}</th><td>{share(row.before)}</td><td>{share(row.after)}</td></tr>)}</tbody></table></div>
    <Pages label="Namespace changes" page={namespacePage} total={comparison.namespaceChanges.length} onPage={setNamespacePage} />
    <h4>Which stored numeric boundaries or split frequencies changed?</h4>
    <p>Comparing exact threshold histogram boundaries and counts for shared predictors—not customer distributions or like-for-like tree identities.</p>
    <div className="evolution-table-scroll" tabIndex={0} role="region" aria-label="Threshold changes"><table className="evolution-table"><caption>Changed numeric threshold summaries ({comparison.thresholdChanges.length})</caption><thead><tr><th scope="col">Predictor</th><th scope="col">Earliest min / max / splits</th><th scope="col">Latest min / max / splits</th><th scope="col">Exact distribution evidence</th></tr></thead><tbody>{comparison.thresholdChanges.slice(thresholdPage * PAGE_SIZE, (thresholdPage + 1) * PAGE_SIZE).map(row => <tr key={row.after.feature}><th scope="row">{row.after.feature}</th><td>{row.before.minimumThreshold ?? 'Not available'} / {row.before.maximumThreshold ?? 'Not available'} / {row.before.numericSplits}</td><td>{row.after.minimumThreshold ?? 'Not available'} / {row.after.maximumThreshold ?? 'Not available'} / {row.after.numericSplits}</td><td><details><summary>Exact before/after threshold bins</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({ earliest: row.before.thresholdBins, latest: row.after.thresholdBins }, null, 2)}</pre></details></td></tr>)}</tbody></table></div>
    <Pages label="Threshold changes" page={thresholdPage} total={comparison.thresholdChanges.length} onPage={setThresholdPage} />
    <h4>Which observed membership sets or frequencies changed?</h4>
    <p>Set comparison uses SHA-256 of sorted distinct stored category values, not training-population vocabulary. Identical cardinality can still conceal different sets. Category values are not retained in the series, so individual added/removed values are not enumerated. No category values are sent to AI.</p>
    <div className="evolution-table-scroll" tabIndex={0} role="region" aria-label="Membership changes"><table className="evolution-table"><caption>Changed or unverifiable membership summaries ({comparison.membershipChanges.length})</caption><thead><tr><th scope="col">Predictor</th><th scope="col">Earliest / latest distinct values</th><th scope="col">Earliest / latest splits</th><th scope="col">Observed set comparison</th></tr></thead><tbody>{comparison.membershipChanges.slice(membershipPage * PAGE_SIZE, (membershipPage + 1) * PAGE_SIZE).map(row => <tr key={row.after.feature}><th scope="row">{row.after.feature}</th><td>{row.before.observedCategories} / {row.after.observedCategories}</td><td>{row.before.membershipSplits} / {row.after.membershipSplits}</td><td>{row.before.categoryDigest === null || row.after.categoryDigest === null ? 'Not available at both endpoints' : row.before.categoryDigest === row.after.categoryDigest ? 'Same observed set; frequency changed' : 'Different observed sets'}</td></tr>)}</tbody></table></div>
    <Pages label="Membership changes" page={membershipPage} total={comparison.membershipChanges.length} onPage={setMembershipPage} />
    <p>Tree-index matching, pruning, retirement and chronological tree-age claims are not enabled: same-model confirmation and export timestamps do not establish tree continuity.</p>
  </section>;
}

function PredictorChanges({ label, names }: { label: string; names: string[] }) {
  const [page, setPage] = useState(0);
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(names.length / PAGE_SIZE) - 1));
  return <details className="predictor-changes"><summary>{label} ({names.length})</summary>{!names.length ? <p>None between these endpoints.</p> : <>
    <ul>{names.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE).map(name => <li key={name}><code>{name}</code></li>)}</ul>
    <Pages label={label} page={visiblePage} total={names.length} onPage={setPage} />
  </>}</details>;
}

function MetricTable({ snapshots }: { snapshots: EvolutionSnapshot[] }) {
  const [page, setPage] = useState(0);
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(snapshots.length / PAGE_SIZE) - 1));
  return <section aria-label="Snapshot metrics">
    <h3>Exact snapshot metrics</h3>
    <p>Structure counts below cover the entire ensemble in each file. AUC is a proportion; success rate is a percentage. Evaluation displays are rounded, with the exact parsed export value alongside. A table row can be retained even when its timestamp is missing.</p>
    <div className="evolution-table-scroll" role="region" aria-label="Snapshot metrics table scroll area" tabIndex={0}>
      <table className="evolution-table"><caption>Exact metrics for all retained snapshots</caption><thead><tr><th scope="col">File / UTC time</th>{metricKeys.map(metric => <th scope="col" key={metric}>{EVOLUTION_METRICS[metric].label}</th>)}</tr></thead><tbody>
        {snapshots.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE).map(snapshot => <tr key={snapshot.id}><th scope="row">{snapshot.name}<br />{snapshot.time ?? 'Time not available'}</th>{metricKeys.map(metric => <td key={metric}>{formatEvolutionValue(metric, snapshot.metrics[metric])}{EVOLUTION_METRICS[metric].group === 'evaluation' && snapshot.metrics[metric] !== null && <small className="evolution-raw-metric">Parsed export: {String(snapshot.metrics[metric])}</small>}</td>)}</tr>)}
      </tbody></table>
    </div>
    <Pages label="Metrics" page={visiblePage} total={snapshots.length} onPage={setPage} />
  </section>;
}

function Pages({ label, page, total, onPage }: { label: string; page: number; total: number; onPage: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  return <nav className="pagination" aria-label={`${label} pages`}><button disabled={!page} onClick={() => onPage(page - 1)}>Previous {label.toLowerCase()}</button><span>{page + 1} / {Math.ceil(total / PAGE_SIZE)}</span><button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => onPage(page + 1)}>Next {label.toLowerCase()}</button></nav>;
}
