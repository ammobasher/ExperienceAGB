import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { TreeNode } from '../domain/agb';
import { layoutTree, TREE_NODE_HEIGHT, TREE_NODE_WIDTH } from '../domain/treeLayout';
import type { PositionedTreeLink, PositionedTreeNode } from '../domain/treeLayout';
import { explainNode } from '../domain/explanations';
import { parseSplit } from '../domain/split';
import { Term } from './TechnicalTerms';

interface Props { tree: TreeNode; treeNumber: number; nodeCount: number; leafCount: number; tracePath?: string[]; focusedNodeId?: string; focusRequest?: number }
interface DrawingBatch { nodes: PositionedTreeNode[]; links: PositionedTreeLink[]; pathIds: ReadonlySet<string>; x: number; y: number; width: number; height: number }
const DRAWING_BATCH_SIZE = 32;
const INITIAL_DRAWING_BATCHES = 2;

function nodeAt(tree: TreeNode, id: string): TreeNode {
  let node = tree;
  for (const side of id.split('.').slice(1)) {
    const next = side === 'L' ? node.left : node.right;
    if (!next) return tree;
    node = next;
  }
  return node;
}
export default function TreeDiagram(props: Props) {
  const { tree, nodeCount } = props;
  const [readyTree, setReadyTree] = useState(() => nodeCount <= DRAWING_BATCH_SIZE * INITIAL_DRAWING_BATCHES ? tree : undefined);
  useEffect(() => {
    if (readyTree === tree) return;
    const timer = setTimeout(() => setReadyTree(tree), 0);
    return () => clearTimeout(timer);
  }, [tree, readyTree]);
  if (nodeCount > DRAWING_BATCH_SIZE * INITIAL_DRAWING_BATCHES && readyTree !== tree) {
    return <div className="diagram-workspace" aria-busy="true"><p role="status">Preparing the complete tree diagram...</p></div>;
  }
  return <CompleteTreeDiagram {...props} />;
}
function CompleteTreeDiagram({ tree, treeNumber, nodeCount, leafCount, tracePath = [], focusedNodeId, focusRequest }: Props) {
  const [rootId, setRootId] = useState('root');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState('root');
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenPending, setFullscreenPending] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const wasFullscreen = useRef(false);
  const restoreFullscreenFocus = useRef(false);
  const drawingRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string>();
  useEffect(() => {
    const changed = () => {
      const active = document.fullscreenElement === workspaceRef.current;
      setFullscreen(active);
      if (wasFullscreen.current && !active) restoreFullscreenFocus.current = true;
      wasFullscreen.current = active;
    };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    if (!fullscreenPending && (fullscreen || restoreFullscreenFocus.current)) {
      fullscreenButtonRef.current?.focus(); restoreFullscreenFocus.current = false;
    }
  }, [fullscreen, fullscreenPending]);
  async function toggleFullscreen() {
    if (fullscreenPending) return;
    setFullscreenError('');
    const element = workspaceRef.current;
    if (!element?.requestFullscreen) {
      setFullscreenError('Diagram fullscreen is unavailable in this browser. You can maximize the browser window instead.');
      return;
    }
    setFullscreenPending(true);
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      restoreFullscreenFocus.current = true;
      setFullscreenError('The browser could not change fullscreen mode. Use the fullscreen button again, or maximize the browser window.');
    } finally { setFullscreenPending(false); }
  }
  function keepFullscreenFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!fullscreen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (document.fullscreenElement === workspaceRef.current) void toggleFullscreen();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...(workspaceRef.current?.querySelectorAll<HTMLElement | SVGElement>('button:not([disabled]), summary, [tabindex="0"]') ?? [])];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  const layout = useMemo(() => layoutTree(nodeAt(tree, rootId), collapsedIds, rootId), [tree, collapsedIds, rootId]);
  const batches = useMemo(() => {
    const linksByTarget = new Map(layout.links.map(link => [link.target.id, link]));
    const result: DrawingBatch[] = [];
    for (let offset = 0; offset < layout.nodes.length; offset += DRAWING_BATCH_SIZE) {
      const nodes = layout.nodes.slice(offset, offset + DRAWING_BATCH_SIZE);
      const links = nodes.flatMap(node => {
        const link = linksByTarget.get(node.id);
        return link ? [link] : [];
      });
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of [...nodes, ...links.map(link => link.source)]) {
        minX = Math.min(minX, node.x); minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x); maxY = Math.max(maxY, node.y);
      }
      result.push({
        nodes, links, pathIds: new Set([...nodes.map(node => node.id), ...links.map(link => link.source.id)]),
        x: minX - TREE_NODE_WIDTH / 2 - 2, y: minY - TREE_NODE_HEIGHT / 2 - 2,
        width: maxX - minX + TREE_NODE_WIDTH + 4, height: maxY - minY + TREE_NODE_HEIGHT + 4,
      });
    }
    return result;
  }, [layout]);
  const initialBatches = layout.nodes.length > DRAWING_BATCH_SIZE * INITIAL_DRAWING_BATCHES ? 0 : INITIAL_DRAWING_BATCHES;
  const [drawing, setDrawing] = useState({ layout, batches: initialBatches });
  if (drawing.layout !== layout) setDrawing({ layout, batches: initialBatches });
  const drawnBatches = drawing.layout === layout ? drawing.batches : initialBatches;
  const renderedNodes = Math.min(drawnBatches * DRAWING_BATCH_SIZE, layout.nodes.length);
  useEffect(() => {
    if (drawnBatches >= batches.length) return;
    const frame = requestAnimationFrame(() => setDrawing(current => current.layout === layout ? { layout, batches: current.batches + 1 } : current));
    return () => cancelAnimationFrame(frame);
  }, [layout, drawnBatches, batches.length]);
  const visibleLeaves = layout.nodes.slice(0, renderedNodes).filter(node => !node.hasChildren).length;
  const hiddenNodes = nodeCount - layout.nodes.length;
  const selected = layout.nodes.find(node => node.id === selectedId) ?? layout.nodes[0];
  const explanation = explainNode(selected.node);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) { viewport.scrollLeft = layout.nodes[0].x * zoom - viewport.clientWidth / 2; viewport.scrollTop = 0; }
  }, [layout]);
  function openPath(id: string, focus: boolean) {
    setRootId('root'); setCollapsedIds(current => current.size ? new Set() : current); setSelectedId(id);
    focusNext.current = focus ? id : undefined;
    if (focus) setSelectionRequest(value => value + 1);
  }
  useEffect(() => {
    const reached = tracePath.at(-1);
    if (reached) openPath(reached, false);
  }, [tracePath]);
  useEffect(() => { if (focusedNodeId) openPath(focusedNodeId, true); }, [focusedNodeId, focusRequest]);
  function revealSelected(focus = true) {
    const target = drawingRef.current?.querySelector<SVGGElement>(`[data-node-id="${selected.id}"]`);
    if (!target) { focusNext.current = selected.id; return false; }
    if (focus) target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'auto' });
    return true;
  }
  useEffect(() => {
    if (focusNext.current === selected.id && revealSelected()) focusNext.current = undefined;
  }, [layout, selectedId, drawnBatches, selectionRequest]);
  const select = useCallback((id: string) => { setSelectedId(id); focusNext.current = id; setSelectionRequest(value => value + 1); }, []);
  function toggleCollapse(id: string) {
    setCollapsedIds(current => {
      const next = new Set(current);
      if (next.has(id)) {
        for (const descendant of next) if (descendant === id || descendant.startsWith(`${id}.`)) next.delete(descendant);
      } else next.add(id);
      return next;
    });
  }
  function fitTree() {
    const available = viewportRef.current?.clientWidth ?? layout.width;
    const availableHeight = viewportRef.current?.clientHeight ?? layout.height;
    setZoom(Math.min(1.6, Math.max(1, available - 4) / layout.width, Math.max(1, availableHeight - 4) / layout.height));
  }
  function focusSubtree(id: string) {
    setRootId(id); setSelectedId(id); setCollapsedIds(current => current.size ? new Set() : current); setZoom(1); focusNext.current = id; setSelectionRequest(value => value + 1);
  }
  return (
    <div ref={workspaceRef} className="diagram-workspace" aria-busy={renderedNodes < layout.nodes.length} role={fullscreen ? 'dialog' : undefined} aria-modal={fullscreen ? true : undefined} aria-label={fullscreen ? `Tree ${treeNumber} diagram fullscreen` : undefined} onKeyDown={keepFullscreenFocus}>
      <div className="diagram-controls">
      <div className="diagram-toolbar">
        <div><span className="diagram-kicker">TREE MAP</span><span className="diagram-count" role="status">{renderedNodes} of {nodeCount} nodes shown; {visibleLeaves} of {leafCount} leaves shown</span></div>
        <div className="zoom-control" aria-label="Diagram zoom controls">
          <button aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(value => Math.max(Number.EPSILON, value / 1.25))}>−</button>
          <span aria-live="polite">{Number((zoom * 100).toPrecision(3))}%</span>
          <button aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(value => Math.min(1.6, value * 1.25))}>+</button>
          <button className="zoom-reset" onClick={() => setZoom(1)}>Reset</button>
          <button className="zoom-reset" onClick={fitTree}>Fit tree</button>
          <button className="zoom-reset" onClick={() => revealSelected()}>Reveal selected node</button>
          <button ref={fullscreenButtonRef} className="zoom-reset" onClick={() => void toggleFullscreen()} disabled={fullscreenPending}>{fullscreen ? 'Exit diagram fullscreen' : 'Enter diagram fullscreen'}</button>
        </div>
      </div>
      <nav className="tree-breadcrumb" aria-label="Tree path">
        <button onClick={() => focusSubtree('root')}>Root</button>
        {rootId !== 'root' && <><span> / {rootId.slice(5).replaceAll('.', ' / ')}</span><button onClick={() => focusSubtree(rootId.slice(0, rootId.lastIndexOf('.')))}>Parent subtree</button></>}
      </nav>
      {fullscreen && <p className="diagram-guidance">Fullscreen shows Tree {treeNumber}. Press Escape or choose Exit diagram fullscreen to return. All zoom, node and subtree controls remain available.</p>}
      {fullscreenError && <p className="error-message" role="alert">{fullscreenError}</p>}
      {renderedNodes < layout.nodes.length && <p className="diagram-guidance" role="progressbar" aria-label="Complete tree drawing" aria-valuemin={0} aria-valuemax={layout.nodes.length} aria-valuenow={renderedNodes}>Drawing the complete tree in scope: {renderedNodes} of {layout.nodes.length} nodes. No automatic collapse or node-count cutoff.</p>}
      <p className="diagram-guidance">True goes left; false goes right. {hiddenNodes > 0 ? `Hidden from this view: ${hiddenNodes} nodes and ${leafCount - layout.nodes.filter(node => !node.hasChildren).length} leaves${rootId !== 'root' ? ', in manually collapsed branches or outside the focused subtree' : ', in manually collapsed branches'}.` : renderedNodes < layout.nodes.length ? 'All nodes in scope are included; drawing is still in progress.' : 'All nodes and leaves are shown.'}</p>
      <div className="diagram-legend" aria-label="Diagram color key"><span><i className="legend-question" aria-hidden="true" />Question (split)</span><span><i className="legend-leaf" aria-hidden="true" />Score contribution (leaf)</span><span><i className="legend-route" aria-hidden="true" />Illustrative route</span></div>
      <details className="diagram-help"><summary>Diagram counts and controls</summary><p className="diagram-guidance">The complete tree in scope is expanded by default; scroll or zoom to explore it. Collapse branches only when you choose. Select a split marked "+ more", then choose "Expand descendants" below the diagram to restore its full subtree. "Focus this subtree" narrows the scope; "Root" restores the complete tree. "Fit tree" changes zoom only. The text outline matches the nodes shown. Colors identify node types and the example route, not model quality.</p></details>
      </div>
      <div ref={viewportRef} className="diagram-canvas" aria-label={`Tree ${treeNumber} diagram viewport`}>
        <div ref={drawingRef} className="tree-svg" role="group" aria-label={`Tree ${treeNumber}, top-down diagram. Select a node to inspect it.`}
          style={{ width: layout.width * zoom, height: layout.height * zoom }}>
          <div className="tree-drawing-plane" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
            {batches.slice(0, drawnBatches).map((batch, index) => <TreeDrawingBatch key={index} batch={batch} selectedId={batch.pathIds.has(selected.id) ? selected.id : undefined} previewKey={tracePath.filter(id => batch.pathIds.has(id)).join('|')} onSelect={select} />)}
          </div>
        </div>
      </div>
      <div className="diagram-details-panel">
      <section className="node-details" aria-label="Selected node details" aria-live="polite">
        <div className="node-details-heading"><span className={`node-kind ${selected.hasChildren ? 'node-kind-split' : 'node-kind-leaf'}`}>{selected.hasChildren ? 'SPLIT NODE' : 'LEAF NODE'}</span><span className="node-path">{selected.id === 'root' ? 'Root' : selected.id.slice(5).replaceAll('.', ' / ')}</span></div>
        <p className="node-explanation"><span className="plain-language-label">IN PLAIN LANGUAGE</span><strong>{explanation.question}</strong><span>{explanation.description}</span></p>
        <details className="technical-details"><summary>Technical fields and provenance</summary><div className="node-details-main">
          <div className="node-condition"><span>{selected.node.split ? 'Condition' : 'Structure'}</span><b>{selected.node.split ?? 'Terminal node; no split condition'}</b></div>
          <div className="node-count-detail"><Term term="sampleCount" /><b>{selected.node.sampleCount.toLocaleString()}</b></div>
          <div className="node-score-detail"><Term term={selected.hasChildren ? 'internalScore' : 'leafScore'} label="Serialized score field" /><b>{formatScore(selected.node.score)}</b></div>
          {selected.node.gain !== undefined && <div className="node-score-detail"><Term term="gain" label="Exported gain (definition unverified)" /><b>{selected.node.gain}</b></div>}
        </div><p className="diagram-guidance">sampleCount and gain are raw export fields, not population estimates, score changes, or causal impact. Gain is a training-time statistic whose exact Pega definition remains an oracle/documentation gate.</p></details>
        {selected.hasChildren && <div className="node-actions"><button className="collapse-action" onClick={() => toggleCollapse(selected.id)}>{selected.collapsed ? 'Expand descendants' : 'Collapse descendants'}</button><button className="collapse-action" onClick={() => focusSubtree(selected.id)}>Focus this subtree</button></div>}
      </section>
      <section className="tree-outline" aria-label="Tree text outline">
        <h3>Text outline</h3>
        <div className="tree-outline-scroll">{batches.slice(0, drawnBatches).map((batch, index) => <TreeOutlineBatch key={index} batch={batch} start={index * DRAWING_BATCH_SIZE + 1} treeNumber={treeNumber} rootId={rootId} selectedId={batch.pathIds.has(selected.id) ? selected.id : undefined} onSelect={select} />)}</div>
      </section>
      <p className="diagram-note">Illustrative trace preview only: sum of selected leaf scores followed by sigmoid. Pega oracle and live-CDH parity remain unverified.</p>
      </div>
    </div>
  );
}
const TreeDrawingBatch = memo(function TreeDrawingBatch({ batch, selectedId, previewKey, onSelect }: {
  batch: DrawingBatch; selectedId?: string; previewKey: string; onSelect: (id: string) => void;
}) {
  const previewPath = new Set(previewKey.split('|'));
  function handleNodeKey(event: KeyboardEvent<SVGGElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
  }
  return <svg className="tree-drawing-batch" role="presentation" width={batch.width} height={batch.height} viewBox={`${batch.x} ${batch.y} ${batch.width} ${batch.height}`} style={{ left: batch.x, top: batch.y }}>
    <g className="tree-links" aria-hidden="true">{batch.links.map(link => {
      const startY = link.source.y + TREE_NODE_HEIGHT / 2, endY = link.target.y - TREE_NODE_HEIGHT / 2;
      const elbowY = startY + (endY - startY) / 2;
      return <g key={link.id}>
        <path className={previewPath.has(link.source.id) && previewPath.has(link.target.id) ? 'is-preview-path' : undefined} d={`M ${link.source.x} ${startY} V ${elbowY} H ${link.target.x} V ${endY}`} />
        <text className="branch-label" x={link.target.x} y={endY - 9} textAnchor="middle">{link.target.id.endsWith('.L') ? 'True / Left' : 'False / Right'}</text>
      </g>;
    })}</g>
    {batch.nodes.map(item => {
      const isLeaf = !item.hasChildren;
      const lines = item.node.split ? splitLines(item.node) : ['Leaf contribution', item.id === 'root' ? 'Root' : item.id.slice(5).replaceAll('.', ' / ')];
      return <g key={item.id} data-node-id={item.id}
        className={`tree-node${item.id === selectedId ? ' is-selected' : ''}${isLeaf ? ' is-leaf' : ''}${previewPath.has(item.id) ? ' is-preview-path' : ''}`}
        role="button" tabIndex={0} aria-pressed={item.id === selectedId}
        aria-label={item.node.split ? `Split node ${item.node.split}; serialized score ${formatScore(item.node.score)}; exported sampleCount ${item.node.sampleCount}; path ${item.id}${item.collapsed ? '; descendants collapsed' : ''}` : `Leaf node; serialized score ${formatScore(item.node.score)}; exported sampleCount ${item.node.sampleCount}; path ${item.id}`}
        onClick={() => onSelect(item.id)} onKeyDown={event => handleNodeKey(event, item.id)}>
        <rect x={item.x - TREE_NODE_WIDTH / 2} y={item.y - TREE_NODE_HEIGHT / 2} width={TREE_NODE_WIDTH} height={TREE_NODE_HEIGHT} rx={isLeaf ? 18 : 7} />
        <text className="tree-node-label" x={item.x - TREE_NODE_WIDTH / 2 + 11} y={item.y - 17}>
          <tspan x={item.x - TREE_NODE_WIDTH / 2 + 11}>{lines[0]}</tspan>
          <tspan className="tree-node-second-line" x={item.x - TREE_NODE_WIDTH / 2 + 11} dy="15">{lines[1]}</tspan>
        </text>
        <text className={`tree-node-score ${item.node.score < 0 ? 'score-negative' : 'score-positive'}`} x={item.x - TREE_NODE_WIDTH / 2 + 11} y={item.y + 31}>score {formatScore(item.node.score)}</text>
        <text className="tree-node-count" x={item.x + TREE_NODE_WIDTH / 2 - 11} y={item.y + 31} textAnchor="end">n={item.node.sampleCount.toLocaleString()}</text>
        {item.collapsed && <text className="collapsed-badge" textAnchor="end" x={item.x + TREE_NODE_WIDTH / 2 - 9} y={item.y - TREE_NODE_HEIGHT / 2 + 11}>+ more</text>}
      </g>;
    })}
  </svg>;
});
const TreeOutlineBatch = memo(function TreeOutlineBatch({ batch, start, treeNumber, rootId, selectedId, onSelect }: {
  batch: DrawingBatch; start: number; treeNumber: number; rootId: string; selectedId?: string; onSelect: (id: string) => void;
}) {
  return <ol start={start} className="tree-outline-batch" style={{ containIntrinsicSize: `auto ${batch.nodes.length * 36}px` }}>{batch.nodes.map(item => <li key={item.id}>
    <button aria-label={`Inspect ${item.id} in tree ${treeNumber}`} aria-pressed={item.id === selectedId} onClick={() => onSelect(item.id)}>
      <b>{item.id}</b> — {item.id === rootId ? 'Subtree root' : item.id.endsWith('.L') ? 'True / Left' : 'False / Right'}: {item.node.split ?? `Leaf contribution ${formatScore(item.node.score)}`} {item.collapsed ? '(descendants collapsed)' : ''}
    </button>
  </li>)}</ol>;
});
function splitLines(node: TreeNode): [string, string] {
  const condition = node.condition ?? parseSplit(node.split ?? '');
  const feature = condition.feature;
  const label = feature.length > 26 ? `…${feature.slice(-25)}` : feature;
  if (condition.operator === 'lt') return [label, `< ${condition.threshold}`.slice(0, 28)];
  if (condition.operator === 'missing') return [label, 'is missing'];
  if (condition.operator === 'in') return [label, `in a set of ${condition.categories?.length ?? 0} values`];
  return [(node.split ?? '').slice(0, 26), 'Inspect condition below'];
}
function formatScore(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`; }
