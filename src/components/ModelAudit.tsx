import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelAnalysis } from '../domain/modelAnalysis';
import { auditMetrics } from '../domain/auditMetrics';
import { formatAuditNumber as number, interpolateRange, rangeFraction } from '../domain/modelAudit';
import type { AuditPredictor, AuditTree, ModelAudit as Audit } from '../domain/modelAudit';
import type { ModelEvidence } from '../domain/modelEvidence';
import type { AuditExportFormat } from '../domain/auditExport';
import { AUDIT_LIMITATIONS } from '../domain/auditExport';
import type { ModelWorkerClient } from '../services/ModelWorkerClient';

const PAGE = 20;
const percent = (value: number | null) => value === null ? 'Not available' : `${number(value * 100)}%`;
const sections = { overview: 'Overview', predictors: 'Predictors', trees: 'Tree diagnostics', history: 'History & context', findings: 'Review findings' } as const;
type Section = keyof typeof sections;
type Navigate = (treeIndex: number, nodeId: string) => void;

export default function ModelAudit({ analysis, client, onNode, onPredictor }: {
  analysis: ModelAnalysis; client: ModelWorkerClient; onNode: Navigate; onPredictor: (predictor: AuditPredictor) => void;
}) {
  const [section, setSection] = useState<Section>('overview');
  const title = useRef<HTMLHeadingElement>(null);
  const audit = analysis.audit, evidence = analysis.modelEvidence;
  useEffect(() => { title.current?.focus(); }, []);
  if (!audit || !evidence) return <p role="alert">Local audit data is unavailable. Reopen the model to recompute it; no file is uploaded.</p>;
  return <section className="model-audit" aria-label="Local model insights">
    <h2 ref={title} tabIndex={-1}>Understand this model</h2>
    <p>Computed from every accepted tree and node, locally. Explore structural evidence—not a model-health verdict, full v6.4 audit or new performance test.</p>
    <nav className="workspace-actions" aria-label="Model insight sections">
      {(Object.keys(sections) as Section[]).map(key => <button key={key} className="button button-quiet" aria-pressed={section === key} onClick={() => setSection(key)}>{sections[key]}</button>)}
    </nav>
    {section === 'overview' && <Overview evidence={evidence} audit={audit} sourceDigest={analysis.sourceDigest} />}
    {section === 'predictors' && <Predictors audit={audit} onSelect={onPredictor} />}
    {section === 'trees' && <TreeDiagnostics trees={audit.trees} onNode={onNode} />}
    {section === 'history' && <History audit={audit} onSelect={onPredictor} onNode={onNode} />}
    {section === 'findings' && <Findings evidence={evidence} audit={audit} onSelect={onPredictor} />}
    <AuditDownload client={client} />
  </section>;
}

function Overview({ evidence, audit, sourceDigest }: { evidence: ModelEvidence; audit: Audit; sourceDigest?: string }) {
  const metrics = auditMetrics(evidence);
  const highlighted = ['monitoring.totalCount', 'monitoring.pooledAUC', 'monitoring.exportedSuccessRate', 'structure.stumpTrees', 'structure.missingChecks', 'gain.totalInternalGain'];
  return <>
    <h3>What does this export tell us?</h3>
    <div className="audit-cards">{metrics.filter(row => highlighted.includes(row.id)).map(row => <article key={row.id}>
      <h4>{row.label}</h4><strong>{number(row.value)}</strong><p>{row.unit} · {row.provenance}</p>
      <p>{row.value === null ? row.reason : row.limitation}</p>
    </article>)}</div>
    <p>{evidence.coverage.trees} trees, {evidence.coverage.nodes} nodes and {evidence.coverage.leaves} leaves contribute to this analysis. {audit.predictors.length} distinct predictors are used. Leaf-gain or AUC availability does not gate independent structure calculations.</p>
    <details className="audit-details"><summary>Metric definitions, operands and availability</summary>
      {metrics.map(row => <article key={row.id}><h4>{row.label} <small>({row.validity})</small></h4><p><code>{row.id}</code>: <b>{row.value === null ? 'Not available' : String(row.value)}</b> {row.unit} · {row.provenance}</p>
        <p>{row.method}</p><p>Operands: <code>{JSON.stringify(row.operands)}</code></p><p>{row.reason ?? row.limitation}</p></article>)}
    </details>
    <details className="audit-details"><summary>What is—and is not—covered?</summary>
      <p>Implemented: complete structure/gain traversal, literal namespaces, name-based roles, numeric threshold histograms, observed membership cardinality, explicit missing checks, depth-by-namespace counts, whole-ensemble leaf density, descriptive review candidates and local snapshot comparisons.</p>
      <ul>{AUDIT_LIMITATIONS.map(item => <li key={item}>{item}</li>)}</ul>
      <p>Source-byte SHA-256: <code>{sourceDigest ?? 'Not available; reopen the model to compute it.'}</code>. This identifies exact input bytes, not model identity or predictive correctness.</p>
    </details>
    <section className="audit-primer" aria-label="From model score to decision">
      <h3>How does a tree score become a decision?</h3>
      <ol><li><b>Leaf contributions</b> — one selected from each tree.</li><li><b>Raw score</b> — the sum of those contributions.</li><li><b>Raw probability</b> — sigmoid of a complete finite raw score; our walkthrough is unverified.</li><li><b>Calibration / exploration</b> — applicable platform behaviour and settings are not reconstructed here.</li><li><b>Business priority / arbitration</b> — not determined by this export alone.</li></ol>
      <p>The last two stages are not observable from these local model statistics. Stored gain is not SHAP or business lift.</p>
    </section>
  </>;
}

function Predictors({ audit, onSelect }: { audit: Audit; onSelect: (row: AuditPredictor) => void }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'gain' | 'splitCount' | 'rootCount'>('gain');
  const [page, setPage] = useState(0);
  const [namespacePage, setNamespacePage] = useState(0);
  const ranked = useMemo(() => [...audit.predictors].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1) || a.feature.localeCompare(b.feature)), [audit, sort]);
  const filtered = useMemo(() => ranked.filter(row => row.feature.toLowerCase().includes(search.toLowerCase())), [ranked, search]);
  const gainRanked = useMemo(() => [...audit.predictors].sort((a, b) => (b.gainShare ?? -1) - (a.gainShare ?? -1)), [audit]);
  const usable = gainRanked.some(row => row.gainShare !== null);
  let cumulative = 0;
  const points = gainRanked.slice(0, PAGE).map(row => ({ ...row, cumulative: cumulative += row.gainShare ?? 0 }));
  return <>
    <h3>Which predictors account for stored split gain?</h3>
    <p>Gain share measures stored internal split gain; split frequency counts questions; root frequency counts first questions. These are different structural observations—not causal effects or Pega SHAP importance.</p>
    {usable ? <figure>
      <BarChart title="Leading predictor gain shares" rows={points.map(row => ({ label: row.feature, value: row.gainShare!, onSelect: () => onSelect(row) }))} />
      <div className="audit-chart" tabIndex={0} role="region" aria-label="Cumulative gain chart scroll area"><svg viewBox="0 0 560 200" role="img" aria-label="Cumulative gain share of the leading 20 predictors; exact values follow in the data table">
        <line x1="54" x2="540" y1="160" y2="160" className="trend-axis" />
        {[0, .5, 1].map(value => <g key={value}><line x1="54" x2="540" y1={160 - 130 * value} y2={160 - 130 * value} className="trend-grid" /><text x="48" y={164 - 130 * value} textAnchor="end">{value * 100}%</text></g>)}
        <path className="trend-line" d={points.map((row, index) => `${index ? 'L' : 'M'}${54 + (index + 1) / points.length * 486},${160 - 130 * row.cumulative}`).join(' ')} />
        <text x="280" y="188" textAnchor="middle">Predictors in descending stored gain order</text>
      </svg></div>
      <figcaption>Leading {points.length} of {audit.predictors.length} predictors account for {percent(points.at(-1)?.cumulative ?? null)} of total internal gain. Chart values are proportions; all exact rows are in the table and local download.</figcaption>
    </figure> : <p>Gain shares are unavailable because total internal gain is incomplete, nonfinite or zero. Split counts, root frequency and other independent metrics remain available below.</p>}
    <label>Find an audit predictor<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
    <label>Rank predictors by<select value={sort} onChange={event => { const value = event.target.value; if (value === 'gain' || value === 'splitCount' || value === 'rootCount') { setSort(value); setPage(0); } }}><option value="gain">Stored internal gain</option><option value="splitCount">Split frequency</option><option value="rootCount">Root frequency</option></select></label>
    <Scroll label="Predictor evidence table"><table className="evolution-table"><caption>Exact predictor evidence across the ensemble ({filtered.length} matches)</caption>
      <thead><tr>{['Predictor / evidence', 'Literal namespace / provisional role', 'Stored gain / share', 'Splits / roots', 'Mean split depth (edges)', 'Missing checks'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{filtered.slice(page * PAGE, (page + 1) * PAGE).map(row => <tr key={row.feature}><th scope="row"><button className="audit-link" onClick={() => onSelect(row)}>{row.feature}</button></th><td>{row.namespace}<br />{row.role}<br />Upstream provenance: unverified</td><td>{row.gain === null ? 'Not available' : String(row.gain)} / {row.gainShare === null ? 'Not available' : String(row.gainShare)}</td><td>{row.splitCount} / {row.rootCount}</td><td>{String(row.meanDepth)}</td><td>{row.missingChecks}</td></tr>)}</tbody>
    </table></Scroll>
    {!filtered.length && <p>No matching predictors. Change the search to see other evidence.</p>}
    <Pages label="Audit predictors" page={page} total={filtered.length} onPage={setPage} />
    <h3>Which literal namespaces supply split gain?</h3>
    <BarChart title="Namespace gain shares" rows={audit.namespaces.filter(row => row.gainShare !== null).sort((a, b) => b.gainShare! - a.gainShare!).slice(0, PAGE).map(row => ({ label: row.namespace, value: row.gainShare! }))} />
    <Scroll label="Namespace evidence"><table className="evolution-table"><caption>Literal namespace evidence</caption><thead><tr><th scope="col">Namespace</th><th scope="col">Predictors</th><th scope="col">Splits</th><th scope="col">Gain share</th></tr></thead><tbody>{audit.namespaces.slice(namespacePage * PAGE, (namespacePage + 1) * PAGE).map(row => <tr key={row.namespace}><th scope="row">{row.namespace}</th><td>{row.predictors}</td><td>{row.splits}</td><td>{row.gainShare === null ? 'Not available' : String(row.gainShare)}</td></tr>)}</tbody></table></Scroll>
    <Pages label="Audit namespaces" page={namespacePage} total={audit.namespaces.length} onPage={setNamespacePage} />
    <p>Namespace is the literal prefix before the first dot; unqualified names form their own group. Roles are provisional name-based interpretations, not evidence that a predictor came from another model. The leading 20 gain shares are charted; page through all exact namespace rows below.</p>
  </>;
}

function TreeDiagnostics({ trees, onNode }: { trees: AuditTree[]; onNode: Navigate }) {
  const [metric, setMetric] = useState<'gain' | 'cumulativeGain' | 'rootCount' | 'depthEdges'>('gain');
  const [page, setPage] = useState(0);
  const labels = { gain: 'Stored internal gain', cumulativeGain: 'Cumulative stored gain', rootCount: 'Exported root sampleCount', depthEdges: 'Depth in edges (root = 0)' };
  const rows = trees.slice(page * PAGE, (page + 1) * PAGE);
  const maximum = rows.reduce((value, row) => Math.max(value, row[metric] ?? 0), 0) || 1;
  const x = (index: number) => 72 + index / Math.max(1, rows.length - 1) * 450;
  const y = (value: number) => 160 - value / maximum * 130;
  return <>
    <h3>How does structure vary by tree export order?</h3>
    <p>Tree number is export index + 1. Order is not a verified timeline; root counters are not tree birth dates or unique customers. Root depth is zero edges (one level in the explorer).</p>
    <label>Tree diagnostic metric<select value={metric} onChange={event => { const key = event.target.value; if (key === 'gain' || key === 'cumulativeGain' || key === 'rootCount' || key === 'depthEdges') setMetric(key); }}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <figure className="audit-chart" tabIndex={0} aria-label="Tree diagnostic chart scroll area"><svg viewBox="0 0 560 225" role="group" aria-label={`${labels[metric]} by tree export order; select a point or table link to explore`}>
      <line x1="72" x2="522" y1="160" y2="160" className="trend-axis" />
      <text x="72" y="18">Scale maximum: {number(maximum)}</text><text x="65" y="164" textAnchor="end">0</text>
      {rows.map((row, index) => row[metric] === null ? null : <g key={row.treeIndex}>
        {index > 0 && rows[index - 1][metric] !== null && <line x1={x(index - 1)} x2={x(index)} y1={y(rows[index - 1][metric]!)} y2={y(row[metric]!)} className="trend-line" />}
        <circle role="button" tabIndex={0} aria-label={`Explore Tree ${row.treeIndex + 1}: ${labels[metric]} ${row[metric]}`} cx={x(index)} cy={y(row[metric]!)} r="6" className="trend-point" onClick={() => onNode(row.treeIndex, 'root')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNode(row.treeIndex, 'root'); } }}><title>Tree {row.treeIndex + 1} — index {row.treeIndex}: {String(row[metric])}</title></circle>
      </g>)}
      <text x="72" y="183">Tree {rows[0].treeIndex + 1}</text><text x="522" y="183" textAnchor="end">Tree {rows.at(-1)!.treeIndex + 1}</text>
      <text x="280" y="211" textAnchor="middle">{labels[metric]} · tree export order</text>
    </svg><figcaption>Showing {rows.length} of {trees.length} trees. Missing values leave gaps, never zeroes. Page through all trees below.</figcaption></figure>
    <Scroll label="Tree diagnostic evidence"><table className="evolution-table"><caption>Exact tree-order diagnostic data</caption><thead><tr>{['Tree / export index', 'Gain', 'Cumulative gain', 'Root counter', 'Depth (edges)', 'Signed leaf-score range'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.treeIndex}><th scope="row"><button className="audit-link" onClick={() => onNode(row.treeIndex, 'root')}>Tree {row.treeIndex + 1} — index {row.treeIndex}</button></th><td>{row.gain === null ? 'Not available' : String(row.gain)}</td><td>{row.cumulativeGain === null ? 'Not available' : String(row.cumulativeGain)}</td><td>{row.rootCount}</td><td>{row.depthEdges}</td><td>{String(row.minimumLeafScore)} to {String(row.maximumLeafScore)}</td></tr>)}</tbody></table></Scroll>
    <Pages label="Audit trees" page={page} total={trees.length} onPage={setPage} />
  </>;
}

function History({ audit, onSelect, onNode }: { audit: Audit; onSelect: (row: AuditPredictor) => void; onNode: Navigate }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(audit.predictors.find(row => row.numericSplits)?.feature);
  const [depthPage, setDepthPage] = useState(0);
  const [leafPage, setLeafPage] = useState(0);
  const rows = useMemo(() => audit.predictors.filter(row => row.feature.toLowerCase().includes(search.toLowerCase())), [audit, search]);
  const current = audit.predictors.find(row => row.feature === selected);
  const ihRows = audit.predictors.filter(row => row.namespace === 'IH');
  const maxDepthCount = audit.depthNamespaces.reduce((maximum, row) => Math.max(maximum, row.splits), 1);
  return <>
    <h3>Which boundaries and contexts does the structure use?</h3>
    <p>Interaction History includes {ihRows.length} distinct IH-prefixed predictors and {ihRows.reduce((sum, row) => sum + row.splitCount, 0)} splits. Names are shown verbatim: outcome/type interpretations remain hypotheses. Membership values and thresholds describe stored conditions, not customer distributions.</p>
    <label>Find a threshold or context predictor<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
    <Scroll label="Threshold and membership inventory"><table className="evolution-table"><caption>Numeric, membership and missing-check inventory ({rows.length} matches)</caption><thead><tr>{['Predictor / occurrence', 'Numeric splits', 'Threshold minimum / maximum', 'Membership splits / distinct observed values', 'Numeric-looking / singleton splits', 'Explicit missing checks', 'Distribution'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.slice(page * PAGE, (page + 1) * PAGE).map(row => <tr key={row.feature}><th scope="row"><button className="audit-link" onClick={() => onSelect(row)}>{row.feature}</button></th><td>{row.numericSplits}</td><td>{row.minimumThreshold === null ? 'Not available' : String(row.minimumThreshold)} / {row.maximumThreshold === null ? 'Not available' : String(row.maximumThreshold)}</td><td>{row.membershipSplits} / {row.observedCategories}</td><td>{row.numericLookingSplits} / {row.singletonSplits}</td><td>{row.missingChecks}</td><td><button className="button button-quiet" disabled={!row.numericSplits} onClick={() => setSelected(row.feature)}>Inspect thresholds for {row.feature}</button></td></tr>)}</tbody></table></Scroll>
    {!rows.length && <p>No matching predictors.</p>}
    <Pages label="Context predictors" page={page} total={rows.length} onPage={setPage} />
    {current && <section aria-label={`Threshold distribution for ${current.feature}`}><h4>Which numeric thresholds recur for {current.feature}?</h4>
      <BarChart title={`Threshold split counts for ${current.feature}`} proportions={false} rows={current.thresholdBins.map(bin => ({ label: `${number(bin.from)} to ${number(bin.to)}`, value: bin.count }))} />
      <Scroll label="Exact threshold bins"><table className="evolution-table"><caption>Exact threshold histogram: {current.feature}</caption><thead><tr><th scope="col">From (inclusive)</th><th scope="col">To (exclusive, except final bin)</th><th scope="col">Split count</th></tr></thead><tbody>{current.thresholdBins.map((bin, index) => <tr key={index}><td>{String(bin.from)}</td><td>{String(bin.to)}</td><td>{bin.count}</td></tr>)}</tbody></table></Scroll>
      {/recency|elapsed|days/i.test(current.feature) && <p>Recency interpretation candidate: if this predictor is measured in days, its minimum boundary is {number(current.minimumThreshold)} days ({number(current.minimumThreshold === null ? null : current.minimumThreshold * 24)} hours). Confirm units and semantics in the predictor definition; the name alone does not establish them.</p>}
      <p>All {current.numericSplits} numeric splits contribute. Constant or floating-point precision-limited ranges use one bin; otherwise 12 equal-width bins. No raw-value sampling, customer frequency or memory-window inference.</p>
    </section>}
    <h3>Where do namespaces appear by depth?</h3>
    <p>Each cell is the number of split occurrences at that edge depth. Colour intensity is relative to the largest cell, not predictive importance.</p>
    <Scroll label="Depth namespace heatmap"><table className="evolution-table"><caption>Depth × literal namespace heatmap (all cells available by paging)</caption><thead><tr><th scope="col">Depth (edges, root = 0)</th><th scope="col">Namespace</th><th scope="col">Split count</th></tr></thead><tbody>{audit.depthNamespaces.slice(depthPage * PAGE, (depthPage + 1) * PAGE).map(row => <tr key={`${row.depth}-${row.namespace}`}><td>{row.depth}</td><th scope="row">{row.namespace}</th><td><span className="audit-heat" style={{ backgroundColor: `rgba(49,95,77,${.08 + row.splits / maxDepthCount * .22})` }}>{row.splits}</span></td></tr>)}</tbody></table></Scroll>
    <Pages label="Depth cells" page={depthPage} total={audit.depthNamespaces.length} onPage={setDepthPage} />
    <LeafDensity bins={audit.leafBins} onNode={onNode} />
    <Scroll label="Leaf density data"><table className="evolution-table"><caption>Exact whole-ensemble leaf-density bins</caption><thead><tr>{['Signed score from / to', 'log(1 + counter) from / to', 'Leaves', 'Example evidence'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{audit.leafBins.slice(leafPage * PAGE, (leafPage + 1) * PAGE).map((bin, index) => <tr key={index}><td>{String(bin.scoreFrom)} / {String(bin.scoreTo)}</td><td>{String(bin.logCountFrom)} / {String(bin.logCountTo)}</td><td>{bin.leaves}</td><td><button className="audit-link" onClick={() => onNode(bin.treeIndex, bin.nodeId)}>Tree {bin.treeIndex + 1}, {bin.nodeId}</button></td></tr>)}</tbody></table></Scroll>
    <Pages label="Leaf bins" page={leafPage} total={audit.leafBins.length} onPage={setLeafPage} />
  </>;
}

function LeafDensity({ bins, onNode }: { bins: Audit['leafBins']; onNode: Navigate }) {
  const minimum = Math.min(...bins.map(row => row.scoreFrom)), maximum = Math.max(...bins.map(row => row.scoreTo));
  const maxLog = Math.max(...bins.map(row => row.logCountTo)), maxLeaves = Math.max(...bins.map(row => row.leaves));
  const x = (value: number) => maximum === minimum ? 290 : 72 + rangeFraction(value, minimum, maximum) * 450;
  const y = (value: number) => maxLog ? 160 - value / maxLog * 130 : 160;
  return <figure className="audit-chart" tabIndex={0} aria-label="Leaf density chart scroll area"><h3>Where are signed leaf contributions concentrated?</h3><svg viewBox="0 0 560 215" role="group" aria-label="All-leaf density by signed score and log counter; select a bin for one example">
    <line x1="72" x2="522" y1="160" y2="160" className="trend-axis" />
    <text x="65" y="30" textAnchor="end">{number(maxLog)}</text><text x="65" y="164" textAnchor="end">0</text>
    {bins.map((bin, index) => <circle key={index} cx={x(interpolateRange(bin.scoreFrom, bin.scoreTo, .5))} cy={y(bin.logCountFrom / 2 + bin.logCountTo / 2)} r={3 + Math.sqrt(bin.leaves / maxLeaves) * 6} className="trend-point" role="button" tabIndex={0} aria-label={`${bin.leaves} leaves; example Tree ${bin.treeIndex + 1}, ${bin.nodeId}`} onClick={() => onNode(bin.treeIndex, bin.nodeId)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNode(bin.treeIndex, bin.nodeId); } }}><title>{bin.leaves} leaves; score {number(bin.scoreFrom)} to {number(bin.scoreTo)}</title></circle>)}
    <text x="72" y="183">{number(minimum)}</text><text x="522" y="183" textAnchor="end">{number(maximum)}</text><text x="290" y="208" textAnchor="middle">Signed serialized leaf score</text><text x="20" y="100" transform="rotate(-90 20 100)" textAnchor="middle">log(1 + sampleCount)</text>
  </svg><figcaption>All {bins.reduce((sum, bin) => sum + bin.leaves, 0)} leaves contribute to at most 24 × 16 bins. Dot size represents leaves, not response positives or statistical confidence. Selecting a bin opens one observed leaf, not a representative profile.</figcaption></figure>;
}

function Findings({ evidence, audit, onSelect }: { evidence: ModelEvidence; audit: Audit; onSelect: (row: AuditPredictor) => void }) {
  const candidates = [
    { label: 'Numeric-looking symbolic values', count: evidence.structure.numericLookingMembershipSplits, meaning: 'Membership strings can contain numbers intentionally. Representation or bucketing is an alternative to a numeric encoding issue.', action: '[Data engineering] Confirm intended field type and category representation.', row: audit.predictors.find(row => row.numericLookingSplits) },
    { label: 'Singleton membership questions', count: evidence.structure.singletonMembershipSplits, meaning: 'A one-value set may be normal. This alone does not establish identifier memorization or overfitting.', action: '[Prediction Studio] Review predictor design against validation outcomes.', row: audit.predictors.find(row => row.singletonSplits) },
    { label: 'Explicit missing checks', count: evidence.structure.missingChecks, meaning: 'The model tests missingness. This does not reveal how often live inputs are missing.', action: '[Data engineering] Measure live input completeness separately.', row: audit.predictors.find(row => row.missingChecks) },
    { label: 'Child-counter differences', count: evidence.structure.sampleCountNotConserved, meaning: 'Child counters do not sum to the parent at these splits. Platform learning semantics may explain this; counts are not customer identities.', action: '[Platform team] Verify exported counter semantics before interpreting any timeline.' },
    { label: 'Stump trees', count: evidence.structure.stumpTrees, meaning: 'A tree without questions can be an intentional platform-baseline contribution, not a defect.', action: '[Prediction Studio] Review baseline context only if an independent outcome warrants investigation.' },
  ];
  const cardinality = [...audit.predictors].filter(row => row.membershipSplits).sort((a, b) => b.observedCategories - a.observedCategories).slice(0, PAGE);
  return <>
    <h3>What deserves a closer look?</h3><p>These are descriptive candidates, not ranked faults. Confidence is high for the counted structure; confidence in a business explanation requires independent evidence. No leakage, fairness, drift or health verdict is inferred.</p>
    <div className="audit-cards">{candidates.map(item => <article key={item.label}><h4>{item.label}</h4><strong>{item.count}</strong><p>{item.meaning}</p><p>{item.action}</p>{item.row && <button className="audit-link" onClick={() => onSelect(item.row!)}>Inspect example: {item.row.feature}</button>}</article>)}</div>
    <h3>Observed membership cardinality</h3><p>The leading {cardinality.length} membership predictors by distinct stored values are below. This is export vocabulary, not the number of categories seen in training or a threshold for “high cardinality.”</p>
    <ul>{cardinality.map(row => <li key={row.feature}><button className="audit-link" onClick={() => onSelect(row)}>{row.feature}</button>: {row.observedCategories} distinct observed values across {row.membershipSplits} membership splits.</li>)}</ul>
    {!cardinality.length && <p>No membership splits are present.</p>}
  </>;
}

function AuditDownload({ client }: { client: ModelWorkerClient }) {
  const [approved, setApproved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [download, setDownload] = useState<{ url: string; format: AuditExportFormat }>();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (download) URL.revokeObjectURL(download.url); }, [download]);
  async function prepare(format: AuditExportFormat) {
    if (!approved || pending) return;
    setPending(true); setError(''); setDownload(undefined);
    try {
      const file = await client.getAuditExport(format);
      if (mounted.current) setDownload({ url: URL.createObjectURL(file), format });
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'The local audit export failed. Retry; no data was uploaded.');
    } finally { if (mounted.current) { setPending(false); setApproved(false); } }
  }
  return <section className="audit-download" aria-label="Download local audit">
    <h3>Keep a reproducible local audit</h3>
    <p>The script-free HTML report and JSON evidence bundle contain sensitive predictor names, thresholds, counters, source hashes and structural statistics. JSON includes exact figure data, predictor CSV and a gain-chart SVG. No raw forest or AI narrative is included. Nothing is uploaded; saving creates a persistent copy outside this app.</p>
    <label><input type="checkbox" checked={approved} disabled={pending} onChange={event => { setApproved(event.target.checked); setDownload(undefined); }} /> I approve preparing a sensitive local audit download.</label>
    <div className="workspace-actions"><button className="button button-quiet" disabled={!approved || pending} onClick={() => void prepare('html')}>Prepare audit HTML</button><button className="button button-quiet" disabled={!approved || pending} onClick={() => void prepare('json')}>Prepare evidence bundle JSON</button></div>
    {pending && <p role="status">Building the audit in the local worker...</p>}
    {download && <p role="status"><a href={download.url} download={`experience-agb-local-audit.${download.format}`}>Save prepared audit {download.format.toUpperCase()}</a>. Delete saved copies when no longer needed.</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
  </section>;
}

function BarChart({ title, rows, proportions = true }: { title: string; rows: Array<{ label: string; value: number; onSelect?: () => void }>; proportions?: boolean }) {
  const maximum = proportions ? 1 : Math.max(1, ...rows.map(row => row.value));
  return <div className="audit-bars" role="group" aria-label={title}><h4>{title}</h4>{!rows.length && <p>Not available: no usable values for this chart.</p>}{rows.map((row, index) => <div className="audit-bar" key={`${row.label}-${index}`}>
    {row.onSelect ? <button className="audit-link" title={row.label} onClick={row.onSelect}>{row.label}</button> : <span title={row.label}>{row.label}</span>}
    <span className="audit-bar-track" aria-hidden="true"><span style={{ width: `${Math.min(100, row.value / maximum * 100)}%` }} /></span><span>{proportions ? percent(row.value) : number(row.value)}</span>
  </div>)}<p>{proportions ? 'Horizontal scale: 0–100% of complete internal split gain.' : 'Horizontal scale: split count, starting at zero.'}</p></div>;
}
function Scroll({ label, children }: { label: string; children: React.ReactNode }) { return <div className="evolution-table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>; }
function Pages({ label, page, total, onPage }: { label: string; page: number; total: number; onPage: (page: number) => void }) {
  if (total <= PAGE) return null;
  return <nav className="pagination" aria-label={`${label} pages`}><button disabled={!page} onClick={() => onPage(page - 1)}>Previous {label.toLowerCase()}</button><span>{page + 1} / {Math.ceil(total / PAGE)}</span><button disabled={(page + 1) * PAGE >= total} onClick={() => onPage(page + 1)}>Next {label.toLowerCase()}</button></nav>;
}
