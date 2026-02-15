/**
 * DiffViewProvider — two-panel D3 diff view (Section H + I).
 *
 * Shows Before/After graph side-by-side with:
 * - Lock Pan/Zoom sync (Snippet 7)
 * - Hover sync across panels (Snippet 8)
 * - Center on selection (Snippet 9)
 * - File-level accept toggle (Snippet 10)
 * - Visual encoding: + added, – removed, Δ changed, T touched
 */

import * as vscode from 'vscode';
import { DiffResult } from '../types/diff';
import { transformToD3Format } from '../analyzer/graphDataTransformer';

export class DiffViewProvider {
  private _panel?: vscode.WebviewPanel;
  private _diffResult?: DiffResult;

  /** Fires when user clicks Apply Selected */
  public onApplySelected?: () => void;
  /** Fires when user clicks Back to Plan */
  public onBackToPlan?: () => void;
  /** Fires when user toggles accept for a file */
  public onToggleAccept?: (filePath: string) => void;
  /** Fires when user clicks Accept All Touched */
  public onAcceptAllTouched?: () => void;
  /** Fires when user clicks Accept None */
  public onAcceptNone?: () => void;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /** Open or reveal the diff view panel */
  public show(diffResult: DiffResult): void {
    this._diffResult = diffResult;

    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      this._sendDiffData();
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      'logocode-diff',
      'LogoCode — Diff View',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this._extensionUri],
      }
    );

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    this._panel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'ready':
          this._sendDiffData();
          break;
        case 'diff:toggleAccept':
          this.onToggleAccept?.(msg.filePath);
          break;
        case 'diff:acceptAllTouched':
          this.onAcceptAllTouched?.();
          break;
        case 'diff:acceptNone':
          this.onAcceptNone?.();
          break;
        case 'diff:applySelected':
          this.onApplySelected?.();
          break;
        case 'diff:backToPlan':
          this.onBackToPlan?.();
          break;
      }
    });

    this._panel.onDidDispose(() => { this._panel = undefined; });
  }

  /** Update the diff data (e.g. after accept toggle) */
  public updateDiffMeta(): void {
    if (!this._panel || !this._diffResult) { return; }
    this._panel.webview.postMessage({
      type: 'updateDiffMeta',
      diffMeta: this._diffResult.diffMeta,
    });
  }

  public dispose(): void { this._panel?.dispose(); }

  private _sendDiffData(): void {
    if (!this._panel || !this._diffResult) { return; }
    const before = transformToD3Format(this._diffResult.beforeGraph);
    const after = transformToD3Format(this._diffResult.afterGraph);
    this._panel.webview.postMessage({
      type: 'initDiff',
      before, after,
      diffMeta: this._diffResult.diffMeta,
      addedNodes: this._diffResult.addedNodes,
      removedNodes: this._diffResult.removedNodes,
      changedNodes: this._diffResult.changedNodes,
      addedEdges: this._diffResult.addedEdges,
      removedEdges: this._diffResult.removedEdges,
    });
  }

  // ── HTML shell ──────────────────────────────────────────────

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const d3Uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'd3.v7.min.js')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>LogoCode Diff</title>
  <style>${DIFF_CSS}</style>
</head>
<body>
  <div id="top-bar">
    <button id="btn-lock" class="tb active" title="Lock Pan/Zoom">🔒</button>
    <button id="btn-center" class="tb" title="Center on Selection">⊙</button>
    <span class="separator"></span>
    <button id="btn-accept-all" class="tb" title="Accept All Touched">✓ All</button>
    <button id="btn-accept-none" class="tb" title="Accept None">✗ None</button>
    <button id="btn-apply" class="tb primary" title="Apply Selected">▶ Apply</button>
    <span class="spacer"></span>
    <button id="btn-back" class="tb" title="Back to Plan">← Back</button>
  </div>
  <div id="diff-container">
    <div id="panel-before" class="diff-panel">
      <div class="panel-label">BEFORE</div>
      <svg id="svg-before"></svg>
    </div>
    <div id="panel-after" class="diff-panel">
      <div class="panel-label">AFTER</div>
      <svg id="svg-after"></svg>
    </div>
  </div>
  <script nonce="${nonce}" src="${d3Uri}"></script>
  <script nonce="${nonce}">${DIFF_JS}</script>
</body>
</html>`;
  }
}

// ── Nonce helper ─────────────────────────────────────────────

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

// ── Embedded CSS ─────────────────────────────────────────────

const DIFF_CSS = `
body {
  margin: 0; padding: 0; overflow: hidden;
  font-family: var(--vscode-font-family, system-ui, sans-serif);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}

/* ── Top bar ──────────────────────────────────────── */
#top-bar {
  display: flex; align-items: center; gap: 4px;
  height: 34px; padding: 0 10px;
  background: var(--vscode-editorGroupHeader-tabsBackground, #252526);
  border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
  font-size: 11px;
}
.tb {
  background: transparent; color: var(--vscode-foreground);
  border: 1px solid transparent; border-radius: 4px;
  padding: 3px 8px; cursor: pointer; font-size: 11px;
  white-space: nowrap;
}
.tb:hover { background: var(--vscode-toolbar-hoverBackground, #ffffff1a); }
.tb.active { border-color: var(--vscode-focusBorder, #007fd4); }
.tb.primary { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); }
.tb.primary:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
.separator { width: 1px; height: 18px; background: var(--vscode-panel-border, #3c3c3c); margin: 0 4px; }
.spacer { flex: 1; }

/* ── Two-panel layout ─────────────────────────────── */
#diff-container {
  display: flex; width: 100vw;
  height: calc(100vh - 35px);
}
.diff-panel {
  flex: 1; position: relative;
  border-right: 1px solid var(--vscode-panel-border, #3c3c3c);
  overflow: hidden;
}
.diff-panel:last-child { border-right: none; }
.panel-label {
  position: absolute; top: 6px; left: 10px;
  font-size: 9px; font-weight: 700; letter-spacing: 1px;
  opacity: 0.4; z-index: 10; pointer-events: none;
}
.diff-panel svg { width: 100%; height: 100%; }

/* ── Cards ────────────────────────────────────────── */
.card { cursor: pointer; }
.card-bg {
  fill: var(--vscode-editor-background);
  stroke: var(--vscode-panel-border, #3c3c3c);
  stroke-width: 1.2; rx: 6; ry: 6;
}
.card:hover .card-bg { stroke: var(--vscode-focusBorder, #007fd4); stroke-width: 1.8; }
.card .title { font-size: 11px; font-weight: 600; fill: var(--vscode-foreground); }
.card .subtitle { font-size: 9.5px; fill: var(--vscode-descriptionForeground, #888); }
.badge-type rect { rx: 3; ry: 3; }
.badge-type text { font-size: 8px; font-weight: 700; fill: #fff; }

/* ── Status badges (diff) ─────────────────────────── */
.badge-status text { font-size: 10px; font-weight: 700; }
.status-added   .card-bg { stroke: #5EC269; stroke-width: 1.6; }
.status-removed .card-bg { stroke: #E06C75; stroke-width: 1.6; stroke-dasharray: 4 2; }
.status-changed .card-bg { stroke: #E8915A; stroke-width: 1.6; }
.status-touched .card-bg { stroke: #B07CD8; stroke-width: 1.6; }

/* ── Accept toggle on cards ───────────────────────── */
.btn-accept { cursor: pointer; }
.btn-accept rect { fill: transparent; stroke: var(--vscode-panel-border, #3c3c3c); stroke-width: 1; rx: 3; ry: 3; }
.btn-accept text { font-size: 10px; fill: var(--vscode-foreground); }
.btn-accept.accepted rect { fill: #5EC269; stroke: #5EC269; }
.btn-accept.accepted text { fill: #fff; }

/* ── Edges ────────────────────────────────────────── */
.link { fill: none; stroke-width: 1.4; stroke-opacity: 0.55; }
.link.import  { stroke: #5B8DEF; }
.link.export  { stroke: #5EC269; }
.link.call    { stroke: #E8915A; stroke-width: 1.8; }
.link.extends { stroke: #E06C75; stroke-width: 1.8; }
.link.implements { stroke: #B07CD8; }
.link.reference  { stroke: #8B8B8B; stroke-opacity: 0.35; }
.link.edge-added   { stroke-dasharray: 6 3; stroke-opacity: 0.8; }
.link.edge-removed { stroke-opacity: 0.2; stroke-dasharray: 2 4; }
.link-arrow { fill: #999; }

/* ── Hover sync ───────────────────────────────────── */
.is-highlight .card-bg { stroke: var(--vscode-focusBorder, #007fd4) !important; stroke-width: 2.2; }
.is-dim { opacity: 0.25; }
.is-dim .link { stroke-opacity: 0.1; }
`;

// ── Embedded JS ──────────────────────────────────────────────

const DIFF_JS = `
const vscode = acquireVsCodeApi();

// ── Color palettes ───────────────────────────────────────
const NODE_COLORS = {
  file: '#5B8DEF', function: '#E8915A', class: '#5EC269',
  method: '#E06C75', interface: '#B07CD8', type: '#8C6B4F', variable: '#D899BA',
};
const STATUS_BADGES = {
  added: { label: '+', color: '#5EC269' },
  removed: { label: '–', color: '#E06C75' },
  changed: { label: 'Δ', color: '#E8915A' },
  touched: { label: 'T', color: '#B07CD8' },
};

// ── Card dimensions (Snippet 1) ──────────────────────────
function cardDims(d) {
  const t = String(d.type);
  const isFile = t === 'file';
  return { w: isFile ? 220 : 180, h: isFile ? 58 : 46 };
}
function truncate(s, max) { return s.length > max ? s.slice(0, max - 1) + '…' : s; }

// ── State ────────────────────────────────────────────────
let diffMeta = null;
let lockPanZoom = true;
let isSyncing = false; // Snippet 7 guard
let hoverState = null;
let selectedNodeId = null;

// Panel state objects
const panels = { before: null, after: null };

// ── Init both panels ─────────────────────────────────────
function initPanel(panelId, svgId) {
  const container = document.getElementById(panelId);
  const svgEl = document.getElementById(svgId);
  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3.select('#' + svgId);
  svg.selectAll('*').remove();

  // Arrow markers
  const defs = svg.append('defs');
  defs.append('marker')
    .attr('id', 'arrow-' + panelId).attr('viewBox', '0 0 10 6')
    .attr('refX', 10).attr('refY', 3)
    .attr('markerWidth', 8).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path').attr('d', 'M0,0L10,3L0,6').attr('class', 'link-arrow');

  const g = svg.append('g').attr('class', 'canvas-root');
  const linkGroup = g.append('g').attr('class', 'links');
  const nodeGroup = g.append('g').attr('class', 'nodes');

  const zoomBehavior = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      panel.currentTransform = event.transform;
      // Sync to other panel (Snippet 7)
      if (lockPanZoom && !isSyncing) {
        const otherKey = panelId === 'panel-before' ? 'after' : 'before';
        const other = panels[otherKey];
        if (other) {
          isSyncing = true;
          other.svg.call(other.zoomBehavior.transform, event.transform);
          isSyncing = false;
        }
      }
    });
  svg.call(zoomBehavior);

  const simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(140))
    .force('charge', d3.forceManyBody().strength(-350))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => {
      const { w, h } = cardDims(d);
      return Math.sqrt(w * w + h * h) / 2 + 8;
    }))
    .on('tick', () => tick(panel));

  const panel = {
    id: panelId,
    svg, g, linkGroup, nodeGroup, zoomBehavior, simulation,
    nodes: [], links: [],
    currentTransform: d3.zoomIdentity,
    width, height,
  };

  return panel;
}

// ── Tick ─────────────────────────────────────────────────────
function tick(panel) {
  panel.linkGroup.selectAll('.link')
    .attr('d', d => {
      const sx = d.source.x, sy = d.source.y;
      const tx = d.target.x, ty = d.target.y;
      return 'M' + sx + ',' + sy + 'L' + tx + ',' + ty;
    });
  panel.nodeGroup.selectAll('.card')
    .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
}

// ── Drag ─────────────────────────────────────────────────────
function drag(sim) {
  return d3.drag()
    .on('start', (event, d) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    })
    .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
    .on('end', (event, d) => {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null; d.fy = null;
    });
}

// ── Update panel with data ───────────────────────────────────
function updatePanel(panel, data, panelType) {
  panel.nodes = data.nodes || [];
  panel.links = data.links || [];

  // Edge status lookup
  const edgeStatus = diffMeta ? diffMeta.edgeStatusByKey : {};

  // Links
  const link = panel.linkGroup.selectAll('.link').data(panel.links, d => d.id);
  link.exit().remove();
  const linkEnter = link.enter().append('path')
    .attr('data-id', d => d.id)
    .attr('class', d => {
      let cls = 'link ' + (d.type || '');
      const st = edgeStatus[d.id] || '';
      if (st === 'added')   cls += ' edge-added';
      if (st === 'removed') cls += ' edge-removed';
      return cls;
    })
    .attr('marker-end', 'url(#arrow-' + panel.id + ')');
  linkEnter.merge(link);

  // Node status lookup
  const nodeStatus = diffMeta ? diffMeta.nodeStatusById : {};
  const acceptMap = diffMeta ? diffMeta.acceptedByFileId : {};

  // Nodes
  const node = panel.nodeGroup.selectAll('.card').data(panel.nodes, d => d.id);
  node.exit().remove();
  const card = node.enter().append('g')
    .attr('data-id', d => d.id)
    .attr('data-status', d => nodeStatus[d.id] || '')
    .attr('class', d => {
      let cls = 'card';
      const st = nodeStatus[d.id];
      if (st && st !== 'unchanged') cls += ' status-' + st;
      return cls;
    })
    .call(drag(panel.simulation))
    .on('click', (event, d) => {
      selectedNodeId = d.id;
      vscode.postMessage({ type: 'nodeClick', filePath: d.filePath, line: d.line });
    })
    .on('mouseenter', (event, d) => {
      hoverState = { id: d.id };
      Object.values(panels).forEach(p => { if (p) applyHoverState(p); });
    })
    .on('mouseleave', () => {
      hoverState = null;
      Object.values(panels).forEach(p => { if (p) applyHoverState(p); });
    });

  // Card background
  card.append('rect').attr('class', 'card-bg')
    .attr('width', d => cardDims(d).w).attr('height', d => cardDims(d).h)
    .attr('x', d => -cardDims(d).w / 2).attr('y', d => -cardDims(d).h / 2);

  // Type badge
  const typeBadge = card.append('g').attr('class', 'badge-type')
    .attr('transform', d => 'translate(' + (-cardDims(d).w / 2 + 6) + ',' + (-cardDims(d).h / 2 + 8) + ')');
  typeBadge.append('rect')
    .attr('width', d => String(d.type).length * 6 + 10).attr('height', 14)
    .attr('fill', d => NODE_COLORS[d.type] || '#8B8B8B');
  typeBadge.append('text').attr('x', 5).attr('y', 10.5)
    .text(d => String(d.type).toUpperCase());

  // Status badge (+/–/Δ/T)
  card.filter(d => STATUS_BADGES[nodeStatus[d.id]])
    .append('g').attr('class', 'badge-status')
    .attr('transform', d => 'translate(' + (cardDims(d).w / 2 - 18) + ',' + (-cardDims(d).h / 2 + 8) + ')')
    .each(function(d) {
      const b = STATUS_BADGES[nodeStatus[d.id]];
      d3.select(this).append('rect').attr('width', 16).attr('height', 16).attr('rx', 3)
        .attr('fill', b.color);
      d3.select(this).append('text').attr('x', 8).attr('y', 12)
        .attr('text-anchor', 'middle').attr('fill', '#fff').text(b.label);
    });

  // Title
  card.append('text').attr('class', 'title')
    .attr('x', d => -cardDims(d).w / 2 + 6)
    .attr('y', d => String(d.type) === 'file' ? 6 : 4)
    .text(d => truncate(d.label, 26));

  // Subtitle
  card.filter(d => String(d.type) !== 'file')
    .append('text').attr('class', 'subtitle')
    .attr('x', d => -cardDims(d).w / 2 + 6).attr('y', 16)
    .text(d => truncate(d.filePath?.split('/').pop() || '', 28));

  // Accept toggle button — only on AFTER panel for file nodes (Snippet 10)
  if (panelType === 'after') {
    const acceptBtn = card.filter(d => String(d.type) === 'file'
      && (nodeStatus[d.id] === 'touched' || nodeStatus[d.id] === 'changed' || nodeStatus[d.id] === 'added'))
      .append('g').attr('class', d => 'btn-accept' + (acceptMap[d.filePath] ? ' accepted' : ''))
      .attr('transform', d => 'translate(' + (cardDims(d).w / 2 - 42) + ',' + (cardDims(d).h / 2 - 20) + ')');
    acceptBtn.append('rect').attr('width', 36).attr('height', 14);
    acceptBtn.append('text').attr('x', 18).attr('y', 10.5).attr('text-anchor', 'middle')
      .text(d => acceptMap[d.filePath] ? '✓ yes' : '✗ no');
    acceptBtn.on('click', (event, d) => {
      event.stopPropagation();
      vscode.postMessage({ type: 'diff:toggleAccept', filePath: d.filePath });
    });
  }

  card.merge(node);

  // Update simulation
  panel.simulation.nodes(panel.nodes);
  panel.simulation.force('link').links(panel.links);
  panel.simulation.alpha(0.8).restart();
}

// ── Hover sync (Snippet 8) ───────────────────────────────
function applyHoverState(panel) {
  panel.nodeGroup.selectAll('.card')
    .classed('is-highlight', d => hoverState?.id === d.id)
    .classed('is-dim', d => hoverState && hoverState.id !== d.id);
  panel.linkGroup.selectAll('.link')
    .classed('is-dim', d => {
      if (!hoverState) return false;
      return d.source.id !== hoverState.id && d.target.id !== hoverState.id;
    });
}

// ── Center on node (Snippet 9) ──────────────────────────
function centerOnNode(nodeId) {
  Object.values(panels).forEach(p => {
    if (!p) return;
    const d = p.nodes.find(n => n.id === nodeId);
    if (!d) return;
    const k = p.currentTransform.k;
    const tx = p.width / 2 - d.x * k;
    const ty = p.height / 2 - d.y * k;
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    if (lockPanZoom) {
      // Apply to both via sync
      isSyncing = false;
    }
    p.svg.transition().duration(250).call(p.zoomBehavior.transform, t);
  });
}

// ── Update accept button states ─────────────────────────
function refreshAcceptButtons() {
  if (!diffMeta || !panels.after) return;
  const acceptMap = diffMeta.acceptedByFileId || {};
  panels.after.nodeGroup.selectAll('.btn-accept')
    .classed('accepted', d => !!acceptMap[d.filePath])
    .select('text')
    .text(d => acceptMap[d.filePath] ? '✓ yes' : '✗ no');
}

// ── Top bar button handlers ─────────────────────────────
document.getElementById('btn-lock').addEventListener('click', function() {
  lockPanZoom = !lockPanZoom;
  this.classList.toggle('active', lockPanZoom);
  // If just turned on, sync after to before's transform
  if (lockPanZoom && panels.before && panels.after) {
    isSyncing = true;
    panels.after.svg.call(panels.after.zoomBehavior.transform, panels.before.currentTransform);
    isSyncing = false;
  }
});

document.getElementById('btn-center').addEventListener('click', () => {
  if (selectedNodeId) centerOnNode(selectedNodeId);
});

document.getElementById('btn-accept-all').addEventListener('click', () => {
  vscode.postMessage({ type: 'diff:acceptAllTouched' });
});

document.getElementById('btn-accept-none').addEventListener('click', () => {
  vscode.postMessage({ type: 'diff:acceptNone' });
});

document.getElementById('btn-apply').addEventListener('click', () => {
  vscode.postMessage({ type: 'diff:applySelected' });
});

document.getElementById('btn-back').addEventListener('click', () => {
  vscode.postMessage({ type: 'diff:backToPlan' });
});

// ── Message handler ─────────────────────────────────────
window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'initDiff':
      diffMeta = msg.diffMeta;
      updatePanel(panels.before, msg.before, 'before');
      updatePanel(panels.after, msg.after, 'after');
      break;
    case 'updateDiffMeta':
      diffMeta = msg.diffMeta;
      refreshAcceptButtons();
      break;
  }
});

// ── Boot ─────────────────────────────────────────────────
panels.before = initPanel('panel-before', 'svg-before');
panels.after  = initPanel('panel-after',  'svg-after');
vscode.postMessage({ type: 'ready' });
`;