import { useEffect, useRef, useState } from 'react';
import type { EnsembleTrace } from '../domain/profileTrace';
import type { MappingBinding, PropensityMapping } from '../domain/propensityMapping';
import { MappingError, MAPPING_LIMITS, mapPropensity, mappingInterval, mappingTemplate, parsePropensityMapping } from '../domain/propensityMapping';
import { formatAuditNumber, formatAuditPercent } from '../domain/modelAudit';
import ExactNumbers from './ExactNumbers';

const PAGE = 20;
export default function PropensityMappingPanel({ binding, trace }: { binding: MappingBinding; trace: EnsembleTrace }) {
  const [mapping, setMapping] = useState<PropensityMapping>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const [templateApproved, setTemplateApproved] = useState(false);
  const [templateURL, setTemplateURL] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const result = mapPropensity(mapping, binding, confirmed, trace);
  const selectedIndex = result.available ? result.index : -1;
  useEffect(() => {
    generation.current++; setMapping(undefined); setConfirmed(false); setBusy(false); setError(''); setNotice('');
    setTemplateApproved(false); setTemplateURL(undefined); setPage(0);
    return () => { generation.current++; };
  }, [binding.sourceSha256, binding.exportTag, binding.exportUpdateTime]);
  useEffect(() => () => { if (templateURL) URL.revokeObjectURL(templateURL); }, [templateURL]);
  useEffect(() => { if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / PAGE)); }, [selectedIndex]);

  function clear() {
    generation.current++; setMapping(undefined); setConfirmed(false); setBusy(false); setError(''); setPage(0);
    setTemplateApproved(false); setTemplateURL(undefined); setNotice('Companion and confirmation cleared from memory. Your files were not changed.');
  }
  async function load(file: File) {
    const request = ++generation.current;
    setBusy(true); setConfirmed(false); setError(''); setNotice('');
    try {
      if (!binding.sourceSha256) throw new MappingError('Reopen the model to compute its source-byte SHA-256 before importing a companion.');
      if (file.size > MAPPING_LIMITS.bytes) throw new MappingError('Companion exceeds the 256 KiB limit. The file was not read.');
      const content = await file.text();
      if (request !== generation.current) return;
      const loaded = parsePropensityMapping(content, binding);
      if (request === generation.current) { setMapping(loaded); setPage(0); setNotice('Companion loaded locally. Review its context and confirm before applying it.'); }
    } catch (cause) {
      if (request === generation.current) setError(`${cause instanceof MappingError ? cause.message : 'The companion could not be read. Check the local file and retry.'} Any previous mapping is retained but disabled until you confirm it again.`);
    } finally { if (request === generation.current) setBusy(false); }
  }
  function prepareTemplate() {
    if (!templateApproved || !binding.sourceSha256) return;
    setError('');
    try {
      setTemplateURL(URL.createObjectURL(new Blob([JSON.stringify(mappingTemplate(binding), null, 2)], { type: 'application/json' })));
      setTemplateApproved(false);
    } catch { setError('The local template could not be prepared. Check browser download support and retry; no file was saved or uploaded.'); }
  }
  return <section className="propensity-mapping" aria-label="Optional Pega score-to-propensity mapping">
    <h3>Pega score-to-propensity mapping <span className="namespace-tag">Optional</span></h3>
    <p>See how a supplied Classifier score interval maps this profile to a probability. This companion format is defined by this app—not a native Pega export adapter. It does not fit Platt scaling or run PAVA.</p>
    <p className="scope-note">Imported metadata and mappings are user-supplied, not independently verified. The original sigmoid preview above is unchanged. Exploration and business arbitration are not calculated.</p>
    {!result.available && <p className="mapping-unavailable" role="status">{result.reason}</p>}
    <details className="audit-details">
      <summary>Import or prepare a companion mapping</summary>
      <p>Maximum 256 KiB and 1,000 ordered intervals. Bind the mapping to the exact model bytes, then explicitly declare the score domain, source context and calculation method. All processing stays on this device; nothing is added to AI requests or browser storage.</p>
      {!binding.sourceSha256 && <p>Source hash unavailable. Reopen the model to compute it before importing or preparing a companion.</p>}
      <input ref={input} className="visually-hidden" type="file" accept=".json,application/json" aria-label="Companion mapping JSON" disabled={busy || !binding.sourceSha256} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (file) void load(file);
      }} />
      <div className="workspace-actions">
        <button className="button button-quiet" disabled={busy || !binding.sourceSha256} onClick={() => input.current?.click()}>Import companion mapping</button>
        {busy && <button className="button button-quiet" onClick={() => { generation.current++; setBusy(false); setNotice('Import cancelled. Any previous mapping remains disabled until confirmed again.'); }}>Cancel mapping import</button>}
        {mapping && <button className="button button-quiet" onClick={clear}>Clear mapping</button>}
      </div>
      <details><summary>Model fingerprint and empty template</summary>
        <p>The template includes this model&apos;s hash, export tag and update time. These identifiers may be sensitive; saving makes a persistent local copy. Empty domain, method, context, provenance and bins must be completed from authoritative evidence, not guessed.</p>
        <dl><dt>Exact source-byte SHA-256</dt><dd><code>{binding.sourceSha256 ?? 'Not available'}</code></dd><dt>Export tag / update time</dt><dd>{binding.exportTag} / {binding.exportUpdateTime ?? 'Not supplied'}</dd></dl>
        <label><input type="checkbox" checked={templateApproved} disabled={!binding.sourceSha256} onChange={event => { setTemplateApproved(event.target.checked); setTemplateURL(undefined); }} /> I approve preparing a local template containing model identifiers.</label>
        <button className="button button-quiet" disabled={!templateApproved || !binding.sourceSha256} onClick={prepareTemplate}>Prepare empty companion template</button>
        {templateURL && <p><a href={templateURL} download="experience-agb-propensity-companion-template.json">Save empty companion template</a>. The template is intentionally not an applicable mapping until completed.</p>}
      </details>
    </details>
    {busy && <p role="status">Reading and validating the local companion...</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {mapping && <>
      <h4>Check the source before using the result</h4>
      <dl className="mapping-source">
        <div><dt>Declared model / action</dt><dd>{mapping.context.modelId} / {mapping.context.action}</dd></div>
        <div><dt>Channel / direction</dt><dd>{mapping.context.channel} / {mapping.context.direction}</dd></div>
        <div><dt>Source reference</dt><dd>{mapping.provenance.reference}</dd></div>
        <div><dt>Platform version / capture time (UTC)</dt><dd>{mapping.provenance.platformVersion} / {mapping.provenance.capturedAt}</dd></div>
        <div><dt>Mapping input</dt><dd>{mapping.inputDomain === 'raw-score' ? 'Raw summed tree score' : 'Sigmoid preview (0–1)'}</dd></div>
        <div><dt>Probability method</dt><dd>{mapping.method === 'exported-values' ? 'Explicit supplied mapped values; no additional smoothing' : 'Supplied pooled bin counts: (positives + 0.5) / (positives + negatives + 1)'}</dd></div>
      </dl>
      <p>The byte hash matches this model file. It does not prove that the declared context, score domain or calibration snapshot is correct.</p>
      <label className="mapping-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> I confirm this mapping belongs to the same model, action/channel/direction and applicable snapshot, and its declared input domain and method match the source evidence.</label>
      {result.available && <div className="mapping-result" role="status">
        <h4>Companion-mapped propensity — unverified Pega reproduction</h4>
        <strong className="mapping-probability">{formatAuditPercent(result.bin.propensity)}</strong>
        <p>Input: <b>{formatAuditNumber(result.input)}</b> in {mapping.inputDomain}. Matched interval <b>{result.index + 1}: {mappingInterval(result.bin, result.index === mapping.bins.length - 1)}</b>.</p>
        <p>{result.bin.positives === null ? 'Supporting positive/negative counts were not supplied.' : `${result.bin.positives.toLocaleString()} positive / ${result.bin.negatives!.toLocaleString()} negative responses in this supplied bin—not tree-node sample counts.`}</p>
        <ExactNumbers values={{ 'Mapping input': result.input, 'Mapped probability (0–1)': result.bin.propensity, Positives: result.bin.positives, Negatives: result.bin.negatives }} />
        <p>For this illustrative profile only. This is a deterministic application of the supplied companion, not platform parity, a live outcome guarantee or a final business priority.</p>
      </div>}
      <MappingChart mapping={mapping} selected={selectedIndex} />
      <div className="evolution-table-scroll" role="region" aria-label="Exact mapping interval evidence" tabIndex={0}>
        <table className="evolution-table"><caption>Exact companion mapping intervals ({mapping.bins.length})</caption><thead><tr><th scope="col">Interval</th><th scope="col">Score range</th><th scope="col">Probability (0–1, unrounded)</th><th scope="col">Positives</th><th scope="col">Negatives</th></tr></thead>
          <tbody>{mapping.bins.slice(page * PAGE, (page + 1) * PAGE).map((bin, offset) => {
            const index = page * PAGE + offset;
            return <tr key={index} className={index === selectedIndex ? 'mapping-matched' : undefined}><th scope="row">{index + 1}{index === selectedIndex && ' — matched'}</th><td>{mappingInterval(bin, index === mapping.bins.length - 1)}</td><td>{String(bin.propensity)}</td><td>{bin.positives ?? 'Not supplied'}</td><td>{bin.negatives ?? 'Not supplied'}</td></tr>;
          })}</tbody>
        </table>
      </div>
      {mapping.bins.length > PAGE && <nav className="pagination" aria-label="Mapping interval pages"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous intervals</button><span>{page + 1} / {Math.ceil(mapping.bins.length / PAGE)}</span><button disabled={(page + 1) * PAGE >= mapping.bins.length} onClick={() => setPage(value => value + 1)}>Next intervals</button></nav>}
      <p className="scope-note">Intervals include the lower bound and exclude the upper bound; the final finite upper bound is included. Null tail bounds mean unbounded, not missing. Scores outside the supplied range are withheld, never clipped.</p>
    </>}
  </section>;
}

function MappingChart({ mapping, selected }: { mapping: PropensityMapping; selected: number }) {
  const width = 440 / mapping.bins.length;
  const path = mapping.bins.map((bin, index) => `${index ? 'L' : 'M'}${70 + index * width},${170 - bin.propensity * 130}H${70 + (index + 1) * width}`).join(' ');
  return <figure className="mapping-chart">
    <div className="trend-scroll" role="region" aria-label="Companion mapping chart scroll area" tabIndex={0}><svg viewBox="0 0 560 230" role="img" aria-label={`Supplied probability mapping across all ${mapping.bins.length} ordered intervals; ${selected >= 0 ? `interval ${selected + 1} matched` : 'no active interval'}`}>
      {[0, .5, 1].map(value => <g key={value}><line x1="70" x2="510" y1={170 - value * 130} y2={170 - value * 130} className="trend-grid" /><text x="60" y={174 - value * 130} textAnchor="end">{value * 100}%</text></g>)}
      {selected >= 0 && <rect x={70 + selected * width} y="35" width={width} height="140" fill="#e2eef8"><title>Matched interval {selected + 1}</title></rect>}
      <path d={path} className="trend-line" />
      <text x="70" y="195">Interval 1</text><text x="510" y="195" textAnchor="end">Interval {mapping.bins.length}</text><text x="290" y="220" textAnchor="middle">Ordered score intervals (equal-width steps)</text>
    </svg></div>
    <figcaption>Each step is one supplied interval. Widths do not represent numeric score distances; exact boundaries and probabilities are in the table. Highlighting follows the confirmed profile mapping. No new calibration is fitted.</figcaption>
  </figure>;
}
