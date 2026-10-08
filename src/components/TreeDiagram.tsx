import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { TreeNode } from '../domain/agb';
import { layoutTree, TREE_NODE_HEIGHT, TREE_NODE_WIDTH } from '../domain/treeLayout';
import { explainNode } from '../domain/explanations';

interface Props { tree: TreeNode; treeNumber: number; tracePath?: string[]; focusedNodeId?: string; focusRequest?: number }

function nodeAt(tree: TreeNode, id: string): TreeNode {
  let node = tree;
  for (const side of id.split('.').slice(1)) {
    const next = side === 'L' ? node.left : node.right;
    if (!next) return tree;
    node = next;
  }
  return node;
}
function initialCollapsed(tree: TreeNode, rootId = 'root'): Set<string> {
  const collapsed = new Set<string>();
  const pending = [{ node: tree, id: rootId, depth: 0 }];
  while (pending.length) {
    const item = pending.pop()!;
    if (item.depth >= 3) { if (item.node.split) collapsed.add(item.id); continue; }
    if (item.node.right) pending.push({ node: item.node.right, id: `${item.id}.R`, depth: item.depth + 1 });
    if (item.node.left) pending.push({ node: item.node.left, id: `${item.id}.L`, depth: item.depth + 1 });
  }
  return collapsed;
}

export default function TreeDiagram({ tree, treeNumber, tracePath = [], focusedNodeId, focusRequest }: Props) {
  const [rootId, setRootId] = useState('root');
  const [collapsedIds, setCollapsedIds] = useState(() => initialCollapsed(tree));
  const [selectedId, setSelectedId] = useState('root');
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string>();
  const layout = useMemo(() => layoutTree(nodeAt(tree, rootId), collapsedIds, rootId), [tree, collapsedIds, rootId]);
  const selected = layout.nodes.find(node => node.id === selectedId) ?? layout.nodes[0];
  const explanation = explainNode(selected.node);
  const previewPath = new Set(tracePath);
  function openPath(id: string, focus: boolean) {
    const parts = id.split('.');
    const base = parts.length > 4 ? parts.slice(0, -2).join('.') : 'root';
    const collapsed = initialCollapsed(nodeAt(tree, base), base);
    let ancestor = base;
    for (const side of parts.slice(base.split('.').length)) {
      collapsed.delete(ancestor); ancestor += `.${side}`;
    }
    setRootId(base); setCollapsedIds(collapsed); setSelectedId(id); setZoom(1);
    focusNext.current = focus ? id : undefined;
  }
  useEffect(() => {
    const reached = tracePath.at(-1);
    if (reached) openPath(reached, false);
  }, [tracePath]);
  useEffect(() => { if (focusedNodeId) openPath(focusedNodeId, true); }, [focusedNodeId, focusRequest]);
  function revealSelected(focus = true) {
    const target = svgRef.current?.querySelector<SVGGElement>(`[data-node-id="${selected.id}"]`);
    if (focus) target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'auto' });
  }
  useEffect(() => {
    if (focusNext.current === selected.id) { focusNext.current = undefined; revealSelected(); }
  }, [layout, selectedId]);
  function select(id: string) { setSelectedId(id); focusNext.current = id; }
  function toggleCollapse(id: string) {
    setCollapsedIds(current => {
      const next = new Set(current);
      if (next.has(id) || layout.nodes.find(node => node.id === id)?.collapsed) {
        next.delete(id);
        for (const descendant of initialCollapsed(nodeAt(tree, id), id)) next.add(descendant);
      } else next.add(id);
      return next;
    });
  }
  function handleNodeKey(event: KeyboardEvent<SVGGElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(id); }
  }
  function fitTree() {
    const available = viewportRef.current?.clientWidth ?? layout.width;
    setZoom(Math.max(0.15, Math.min(1.6, (available - 4) / layout.width)));
  }
  function focusSubtree(id: string) {
    setRootId(id); setSelectedId(id); setCollapsedIds(initialCollapsed(nodeAt(tree, id), id)); setZoom(1); focusNext.current = id;
  }
  return (
    <div className="diagram-workspace">
      <div className="diagram-toolbar">
        <div><span className="diagram-kicker">TREE MAP</span><span className="diagram-count">{layout.nodes.length} visible nodes</span></div>
        <div className="zoom-control" aria-label="Diagram zoom controls">
          <button aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(value => Math.max(0.15, value - 0.1))}>−</button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(value => Math.min(1.6, value + 0.1))}>+</button>
          <button className="zoom-reset" onClick={() => setZoom(1)}>Reset</button>
          <button className="zoom-reset" onClick={fitTree}>Fit tree</button>
          <button className="zoom-reset" onClick={() => revealSelected()}>Reveal selected node</button>
        </div>
      </div>
      <nav className="tree-breadcrumb" aria-label="Tree path">
        <button onClick={() => focusSubtree('root')}>Root</button>
        {rootId !== 'root' && <><span> / {rootId.slice(5).replaceAll('.', ' / ')}</span><button onClick={() => focusSubtree(rootId.slice(0, rootId.lastIndexOf('.')))}>Parent subtree</button></>}
      </nav>
      <p className="diagram-guidance">True goes left; false goes right. Large branches are collapsed automatically; expand or focus a subtree to inspect more. The text outline has the same visible nodes.</p>
      <div ref={viewportRef} className="diagram-canvas" aria-label={`Tree ${treeNumber} diagram viewport`}>
        <svg ref={svgRef} className="tree-svg" role="group" aria-label={`Tree ${treeNumber}, top-down diagram. Select a node to inspect it.`}
          width={layout.width * zoom} height={layout.height * zoom} viewBox={`0 0 ${layout.width} ${layout.height}`}>
          <g className="tree-links" aria-hidden="true">
            {layout.links.map(link => {
              const startY = link.source.y + TREE_NODE_HEIGHT / 2, endY = link.target.y - TREE_NODE_HEIGHT / 2;
              const elbowY = startY + (endY - startY) / 2;
              return <g key={link.id}>
                <path className={previewPath.has(link.source.id) && previewPath.has(link.target.id) ? 'is-preview-path' : undefined} d={`M ${link.source.x} ${startY} V ${elbowY} H ${link.target.x} V ${endY}`} />
                <text className="branch-label" x={link.target.x} y={endY - 9} textAnchor="middle">{link.target.id.endsWith('.L') ? 'True / Left' : 'False / Right'}</text>
              </g>;
            })}
          </g>
          {layout.nodes.map(item => {
            const isLeaf = !item.hasChildren;
            const lines = item.node.split ? splitLines(item.node.split) : ['Leaf contribution', item.id === 'root' ? 'Root' : item.id.slice(5).replaceAll('.', ' / ')];
            return <g key={item.id} data-node-id={item.id}
              className={`tree-node${item.id === selected.id ? ' is-selected' : ''}${isLeaf ? ' is-leaf' : ''}${previewPath.has(item.id) ? ' is-preview-path' : ''}`}
              role="button" tabIndex={0} aria-pressed={item.id === selected.id}
              aria-label={item.node.split ? `Split node ${item.node.split}; serialized score ${formatScore(item.node.score)}; exported sampleCount ${item.node.sampleCount}; path ${item.id}` : `Leaf node; serialized score ${formatScore(item.node.score)}; exported sampleCount ${item.node.sampleCount}; path ${item.id}`}
              onClick={() => select(item.id)} onKeyDown={event => handleNodeKey(event, item.id)}>
              <rect x={item.x - TREE_NODE_WIDTH / 2} y={item.y - TREE_NODE_HEIGHT / 2} width={TREE_NODE_WIDTH} height={TREE_NODE_HEIGHT} rx={isLeaf ? 18 : 7} />
              <text className="tree-node-label" x={item.x - TREE_NODE_WIDTH / 2 + 11} y={item.y - 17}>
                <tspan x={item.x - TREE_NODE_WIDTH / 2 + 11}>{lines[0]}</tspan>
                <tspan className="tree-node-second-line" x={item.x - TREE_NODE_WIDTH / 2 + 11} dy="15">{lines[1]}</tspan>
              </text>
              <text className={`tree-node-score ${item.node.score < 0 ? 'score-negative' : 'score-positive'}`} x={item.x - TREE_NODE_WIDTH / 2 + 11} y={item.y + 31}>score {formatScore(item.node.score)}</text>
              <text className="tree-node-count" x={item.x + TREE_NODE_WIDTH / 2 - 11} y={item.y + 31} textAnchor="end">n={item.node.sampleCount.toLocaleString()}</text>
              {item.collapsed && <text className="collapsed-badge" x={item.x + TREE_NODE_WIDTH / 2 - 9} y={item.y - TREE_NODE_HEIGHT / 2 + 11}>+</text>}
            </g>;
          })}
        </svg>
      </div>
      <section className="node-details" aria-label="Selected node details" aria-live="polite">
        <div className="node-details-heading"><span className={`node-kind ${selected.hasChildren ? 'node-kind-split' : 'node-kind-leaf'}`}>{selected.hasChildren ? 'SPLIT NODE' : 'LEAF NODE'}</span><span className="node-path">{selected.id === 'root' ? 'Root' : selected.id.slice(5).replaceAll('.', ' / ')}</span></div>
        <p className="node-explanation"><b>{explanation.question}</b><br />{explanation.description}</p>
        <details className="technical-details"><summary>Technical fields and provenance</summary><div className="node-details-main">
          <div className="node-condition"><span>{selected.node.split ? 'Condition' : 'Structure'}</span><b>{selected.node.split ?? 'Terminal node; no split condition'}</b></div>
          <div className="node-count-detail"><span>Exported sampleCount</span><b>{selected.node.sampleCount.toLocaleString()}</b></div>
          <div className="node-score-detail"><span>Serialized score field</span><b>{formatScore(selected.node.score)}</b></div>
          {selected.node.gain !== undefined && <div className="node-score-detail"><span>Exported gain (definition unverified)</span><b>{selected.node.gain}</b></div>}
        </div><p className="diagram-guidance">sampleCount and gain are raw export fields, not population estimates, score changes, or causal impact. Gain is a training-time statistic whose exact Pega definition remains an oracle/documentation gate.</p></details>
        {selected.hasChildren && <div className="node-actions"><button className="collapse-action" onClick={() => toggleCollapse(selected.id)}>{selected.collapsed ? 'Expand descendants' : 'Collapse descendants'}</button><button className="collapse-action" onClick={() => focusSubtree(selected.id)}>Focus this subtree</button></div>}
      </section>
      <section className="tree-outline" aria-label="Tree text outline">
        <h3>Text outline</h3>
        <ol>{layout.nodes.map(item => <li key={item.id}>
          <button aria-label={`Inspect ${item.id} in tree ${treeNumber}`} aria-pressed={item.id === selected.id} onClick={() => select(item.id)}>
            <b>{item.id}</b> — {item.id === rootId ? 'Subtree root' : item.id.endsWith('.L') ? 'True / Left' : 'False / Right'}: {item.node.split ?? `Leaf contribution ${formatScore(item.node.score)}`} {item.collapsed ? '(descendants collapsed)' : ''}
          </button>
        </li>)}</ol>
      </section>
      <p className="diagram-note">Illustrative trace preview only: sum of selected leaf scores followed by sigmoid. Pega oracle and live-CDH parity remain unverified.</p>
    </div>
  );
}
function splitLines(split: string): [string, string] {
  const match = split.trim().match(/^(.+?)\s*(<|in|is)\s*(.+)$/i);
  if (!match) return [split.slice(0, 24), 'Inspect condition below'];
  return [match[1].length > 24 ? `${match[1].slice(-21)}…` : match[1], `${match[2]} ${match[3]}`.slice(0, 28)];
}
function formatScore(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`; }
