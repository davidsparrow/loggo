/**
 * CodemapViewProvider — manages the D3 graph canvas as a WebviewPanel.
 *
 * Card-based node rendering (Section F), stable data-id (Snippet 2),
 * force collision for cards (Snippet 4), icon-only zoom controls.
 */

import * as vscode from 'vscode';
import { GraphData } from '../types/graph';
import { transformToD3Format } from '../analyzer/graphDataTransformer';

export class CodemapViewProvider {
  private _panel?: vscode.WebviewPanel;
  private _graphData?: GraphData;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /** Create or reveal the graph canvas panel in the editor area */
  public show(): void {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      'logocode-canvas',
      'LogoCode — Graph Canvas',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this._extensionUri],
      }
    );

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Message handling
    this._panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'nodeClick':
          if (msg.filePath) {
            const uri = vscode.Uri.file(msg.filePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            if (msg.line !== undefined) {
              const pos = new vscode.Position(msg.line - 1, msg.column ? msg.column - 1 : 0);
              editor.selection = new vscode.Selection(pos, pos);
              editor.revealRange(new vscode.Range(pos, pos));
            }
          }
          break;
        case 'ready':
          if (this._graphData) {
            this.updateGraph(this._graphData);
          }
          break;
      }
    });

    this._panel.onDidDispose(() => {
      this._panel = undefined;
    });
  }

  /** Send graph data to the webview */
  public updateGraph(graphData: GraphData): void {
    this._graphData = graphData;
    if (!this._panel) { return; }
    const d3Data = transformToD3Format(graphData);
    console.log(`[LogoCode] Sending ${d3Data.nodes.length} nodes, ${d3Data.links.length} links to canvas`);
    this._panel.webview.postMessage({ type: 'updateGraph', data: d3Data });
  }

  public dispose(): void {
    this._panel?.dispose();
  }

  // ── HTML generation ────────────────────────────────────────

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
  <title>LogoCode Canvas</title>
  <style>${this._getCss()}</style>
</head>
<body>
  <div id="graph-container">
    <svg id="graph-svg"></svg>
    <div id="tooltip" class="tooltip"></div>
    <div id="controls">
      <button id="btn-zoom-in" title="Zoom in">⊕</button>
      <button id="btn-zoom-out" title="Zoom out">⊖</button>
      <button id="btn-fit" title="Fit to view">⊡</button>
    </div>
    <div id="info-badge"></div>
  </div>
  <script nonce="${nonce}" src="${d3Uri}"></script>
  <script nonce="${nonce}">${this._getJs()}</script>
</body>
</html>`;
  }

  // CSS and JS methods are split out for readability — appended below
  private _getCss(): string { return CSS_CONTENT; }
  private _getJs(): string { return JS_CONTENT; }
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

const CSS_CONTENT = `
body {
  margin: 0; padding: 0; overflow: hidden;
  font-family: var(--vscode-font-family, system-ui, sans-serif);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}
#graph-container { width: 100vw; height: 100vh; position: relative; }
svg { width: 100%; height: 100%; }

/* ── Cards ──────────────────────────────────────────── */
.card { cursor: pointer; }
.card-bg {
  fill: var(--vscode-editor-background);
  stroke: var(--vscode-panel-border, #3c3c3c);
  stroke-width: 1.2;
  rx: 6; ry: 6;
}
.card:hover .card-bg {
  stroke: var(--vscode-focusBorder, #007fd4);
  stroke-width: 1.8;
}
.card .title {
  font-size: 11px; font-weight: 600;
  fill: var(--vscode-foreground);
}
.card .subtitle {
  font-size: 9.5px;
  fill: var(--vscode-descriptionForeground, #888);
}
.badge-type rect { rx: 3; ry: 3; }
.badge-type text { font-size: 8px; font-weight: 700; fill: #fff; }

/* ── Edges ─────────────────────────────────────────── */
.link { fill: none; stroke-width: 1.4; stroke-opacity: 0.55; }
.link.import  { stroke: #5B8DEF; }
.link.export  { stroke: #5EC269; }
.link.call    { stroke: #E8915A; stroke-width: 1.8; }
.link.extends { stroke: #E06C75; stroke-width: 1.8; }
.link.implements { stroke: #B07CD8; }
.link.reference  { stroke: #8B8B8B; stroke-opacity: 0.35; }

.link-arrow { fill: #999; }

/* ── Tooltip ───────────────────────────────────────── */
.tooltip {
  position: absolute; pointer-events: none;
  padding: 6px 10px; border-radius: 4px;
  background: var(--vscode-editorWidget-background, #252526);
  border: 1px solid var(--vscode-panel-border, #3c3c3c);
  font-size: 11px; opacity: 0;
  transition: opacity .15s ease;
  max-width: 300px; z-index: 100;
}
.tooltip.visible { opacity: 1; }

/* ── Controls (icon-only) ──────────────────────────── */
#controls {
  position: absolute; top: 10px; right: 10px;
  display: flex; flex-direction: column; gap: 2px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border, #3c3c3c);
  border-radius: 6px; padding: 4px;
  z-index: 50;
}
#controls button {
  width: 26px; height: 26px;
  background: transparent; color: var(--vscode-foreground);
  border: none; border-radius: 4px; cursor: pointer;
  font-size: 14px; display: flex; align-items: center; justify-content: center;
}
#controls button:hover { background: var(--vscode-toolbar-hoverBackground, #ffffff1a); }

/* ── Info badge ────────────────────────────────────── */
#info-badge {
  position: absolute; bottom: 8px; left: 10px;
  font-size: 10px; opacity: 0.55;
}

/* ── Diff / hover helpers ──────────────────────────── */
.is-highlight .card-bg { stroke: var(--vscode-focusBorder, #007fd4); stroke-width: 2; }
.is-dim { opacity: 0.35; }
.status-added   .card-bg { stroke: #5EC269; }
.status-removed .card-bg { stroke: #E06C75; }
.status-changed .card-bg { stroke: #E8915A; }
.status-touched .card-bg { stroke: #B07CD8; }
`;

// ── Embedded JS ──────────────────────────────────────────────

const JS_CONTENT = `
// ── Acquire VS Code API ──────────────────────────────────
const vscode = acquireVsCodeApi();

// ── Color palettes ───────────────────────────────────────
const NODE_COLORS = {
  file: '#5B8DEF', function: '#E8915A', class: '#5EC269',
  method: '#E06C75', interface: '#B07CD8', type: '#8C6B4F', variable: '#D899BA',
};
const EDGE_COLORS = {
  import: '#5B8DEF', export: '#5EC269', call: '#E8915A',
  extends: '#E06C75', implements: '#B07CD8', reference: '#8B8B8B',
};

// ── Card dimension helper (Snippet 1) ────────────────────
function cardDims(d) {
  const t = String(d.type);
  const isFile = t === 'file';
  return { w: isFile ? 220 : 180, h: isFile ? 58 : 46 };
}

// ── State ────────────────────────────────────────────────
let simulation, svg, g, linkGroup, nodeGroup, zoomBehavior;
let graphNodes = [], graphLinks = [];
let hoverState = null;
let currentTransform = d3.zoomIdentity;

// ── Init ─────────────────────────────────────────────────
function initGraph() {
  const container = document.getElementById('graph-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  svg = d3.select('#graph-svg');
  svg.selectAll('*').remove();

  // Arrow marker
  const defs = svg.append('defs');
  defs.append('marker')
    .attr('id', 'arrow').attr('viewBox', '0 0 10 6')
    .attr('refX', 10).attr('refY', 3)
    .attr('markerWidth', 8).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path').attr('d', 'M0,0L10,3L0,6').attr('class', 'link-arrow');

  g = svg.append('g').attr('class', 'canvas-root');
  linkGroup = g.append('g').attr('class', 'links');
  nodeGroup = g.append('g').attr('class', 'nodes');

  // Zoom
  zoomBehavior = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      currentTransform = event.transform;
      g.attr('transform', event.transform);
    });
  svg.call(zoomBehavior);

  // Controls
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    svg.transition().duration(200).call(zoomBehavior.scaleBy, 1.3);
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    svg.transition().duration(200).call(zoomBehavior.scaleBy, 0.7);
  });
  document.getElementById('btn-fit').addEventListener('click', fitToView);

  // Simulation
  simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(160))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => {
      const { w, h } = cardDims(d);
      return Math.sqrt(w * w + h * h) / 2 + 8;
    }))
    .on('tick', ticked);
}

// ── Update graph ─────────────────────────────────────────
function updateGraph(data) {
  graphNodes = data.nodes || [];
  graphLinks = data.links || [];
  document.getElementById('info-badge').textContent =
    graphNodes.length + ' nodes · ' + graphLinks.length + ' edges';

  // Links
  const link = linkGroup.selectAll('.link').data(graphLinks, d => d.id);
  link.exit().remove();
  const linkEnter = link.enter().append('path')
    .attr('class', d => 'link ' + (d.type || ''))
    .attr('data-id', d => d.id)
    .attr('marker-end', 'url(#arrow)');
  linkEnter.merge(link);

  // Nodes
  const node = nodeGroup.selectAll('.card').data(graphNodes, d => d.id);
  node.exit().remove();
  const card = node.enter().append('g')
    .attr('class', d => {
      let cls = 'card';
      const status = d.metadata?.diffStatus;
      if (status) cls += ' status-' + status;
      return cls;
    })
    .attr('data-id', d => d.id)
    .attr('data-status', d => d.metadata?.diffStatus || '')
    .call(drag(simulation))
    .on('click', (event, d) => {
      vscode.postMessage({ type: 'nodeClick', filePath: d.filePath, line: d.line, column: d.column });
    })
    .on('mouseenter', (event, d) => showTooltip(event, d))
    .on('mouseleave', () => hideTooltip());

  // Card background
  card.append('rect').attr('class', 'card-bg')
    .attr('width', d => cardDims(d).w)
    .attr('height', d => cardDims(d).h)
    .attr('x', d => -cardDims(d).w / 2)
    .attr('y', d => -cardDims(d).h / 2);

  // Type badge
  const badge = card.append('g').attr('class', 'badge-type')
    .attr('transform', d => 'translate(' + (-cardDims(d).w / 2 + 6) + ',' + (-cardDims(d).h / 2 + 8) + ')');
  badge.append('rect')
    .attr('width', d => String(d.type).length * 6 + 10)
    .attr('height', 14)
    .attr('fill', d => NODE_COLORS[d.type] || '#8B8B8B');
  badge.append('text')
    .attr('x', 5).attr('y', 10.5)
    .text(d => String(d.type).toUpperCase());

  // Title
  card.append('text').attr('class', 'title')
    .attr('x', d => -cardDims(d).w / 2 + 6)
    .attr('y', d => String(d.type) === 'file' ? 6 : 4)
    .text(d => truncate(d.label, 28));

  // Subtitle (file path for non-files)
  card.filter(d => String(d.type) !== 'file')
    .append('text').attr('class', 'subtitle')
    .attr('x', d => -cardDims(d).w / 2 + 6)
    .attr('y', d => 16)
    .text(d => truncate(d.filePath?.split('/').pop() || '', 30));

  card.merge(node);

  // Update simulation
  simulation.nodes(graphNodes);
  simulation.force('link').links(graphLinks);
  simulation.alpha(0.8).restart();
}

// ── Tick ──────────────────────────────────────────────────
function ticked() {
  linkGroup.selectAll('.link')
    .attr('d', d => {
      const sx = d.source.x, sy = d.source.y;
      const tx = d.target.x, ty = d.target.y;
      return 'M' + sx + ',' + sy + 'L' + tx + ',' + ty;
    });
  nodeGroup.selectAll('.card')
    .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
}

// ── Drag ──────────────────────────────────────────────────
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

// ── Tooltip ───────────────────────────────────────────────
const tooltipEl = () => document.getElementById('tooltip');

function showTooltip(event, d) {
  const tip = tooltipEl();
  let html = '<strong>' + d.label + '</strong>';
  html += '<br><span style="opacity:.6">' + d.type + '</span>';
  if (d.filePath) html += '<br>' + d.filePath;
  if (d.line) html += ':' + d.line;
  tip.innerHTML = html;
  tip.style.left = (event.offsetX + 14) + 'px';
  tip.style.top = (event.offsetY - 10) + 'px';
  tip.classList.add('visible');
}
function hideTooltip() { tooltipEl().classList.remove('visible'); }

// ── Fit to view ───────────────────────────────────────────
function fitToView() {
  if (!graphNodes.length) return;
  const container = document.getElementById('graph-container');
  const W = container.clientWidth, H = container.clientHeight;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  graphNodes.forEach(d => {
    const { w, h } = cardDims(d);
    if (d.x - w / 2 < minX) minX = d.x - w / 2;
    if (d.y - h / 2 < minY) minY = d.y - h / 2;
    if (d.x + w / 2 > maxX) maxX = d.x + w / 2;
    if (d.y + h / 2 > maxY) maxY = d.y + h / 2;
  });
  const pad = 40;
  const gW = maxX - minX + pad * 2;
  const gH = maxY - minY + pad * 2;
  const scale = Math.min(W / gW, H / gH, 2);
  const tx = W / 2 - (minX + (maxX - minX) / 2) * scale;
  const ty = H / 2 - (minY + (maxY - minY) / 2) * scale;
  svg.transition().duration(400)
    .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

// ── Helpers ───────────────────────────────────────────────
function truncate(s, max) { return s.length > max ? s.slice(0, max - 1) + '…' : s; }

// ── Center on node (Snippet 9 — for future use) ──────────
function centerOnNode(nodeId) {
  const d = graphNodes.find(n => n.id === nodeId);
  if (!d) return;
  const container = document.getElementById('graph-container');
  const W = container.clientWidth, H = container.clientHeight;
  const k = currentTransform.k;
  const tx = W / 2 - d.x * k;
  const ty = H / 2 - d.y * k;
  svg.transition().duration(250)
    .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
}

// ── Hover sync (Snippet 8 — for future diff view) ────────
function applyHoverState(panel) {
  panel.selectAll('.card')
    .classed('is-highlight', d => hoverState?.id === d.id)
    .classed('is-dim', d => hoverState && hoverState.id !== d.id);
}

// ── Message handler ───────────────────────────────────────
window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'updateGraph':
      updateGraph(msg.data);
      break;
    case 'centerOnNode':
      centerOnNode(msg.nodeId);
      break;
  }
});

// ── Boot ──────────────────────────────────────────────────
initGraph();
vscode.postMessage({ type: 'ready' });
`;

