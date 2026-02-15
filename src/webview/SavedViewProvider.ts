/**
 * SavedViewProvider — saved search presets sidebar panel.
 *
 * Lists saved presets with persistent filter. Clicking a preset switches
 * to Search tab, restores mode + params, and executes the search.
 */

import * as vscode from 'vscode';
import { SavedSearchPreset } from '../types/search';

export class SavedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'logocode-saved';

  private _view?: vscode.WebviewView;
  private _presets: SavedSearchPreset[] = [];

  /** Fires when user clicks a preset to execute */
  public onExecutePreset?: (preset: SavedSearchPreset) => void;
  /** Fires when user deletes a preset */
  public onDeletePreset?: (presetId: string) => void;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'execute':
          if (msg.index !== undefined && this._presets[msg.index]) {
            this.onExecutePreset?.(this._presets[msg.index]);
          }
          break;
        case 'delete':
          if (msg.id) { this.onDeletePreset?.(msg.id); }
          break;
        case 'ready':
          this._sync();
          break;
      }
    });
  }

  /** Update the preset list */
  public setPresets(presets: SavedSearchPreset[]): void {
    this._presets = presets;
    this._sync();
  }

  private _sync(): void {
    this._view?.webview.postMessage({ type: 'presets', presets: this._presets });
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <style>${CSS}</style>
</head><body>
  <div class="panel">
    <div class="filter-row">
      <input id="filter" type="text" placeholder="Filter presets…" spellcheck="false" />
    </div>
    <div id="list" class="preset-list"></div>
    <div id="empty" class="empty-msg">No saved searches yet</div>
  </div>
  <script nonce="${nonce}">${JS}</script>
</body></html>`;
  }
}

function getNonce(): string {
  let t = '';
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) { t += c.charAt(Math.floor(Math.random() * c.length)); }
  return t;
}

const CSS = `
body { margin:0; padding:0; font-family: var(--vscode-font-family, system-ui, sans-serif); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-size: 12px; }
.panel { display:flex; flex-direction:column; height:100vh; }
.filter-row { padding:6px 8px; border-bottom:1px solid var(--vscode-panel-border,#333); }
.filter-row input { width:100%; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border,transparent); border-radius:3px; padding:4px 6px; font-size:11px; outline:none; }
.filter-row input:focus { border-color:var(--vscode-focusBorder); }
.preset-list { flex:1; overflow-y:auto; }
.preset-item { display:flex; align-items:center; gap:6px; padding:6px 10px; cursor:pointer; border-bottom:1px solid var(--vscode-panel-border,#222); }
.preset-item:hover { background:var(--vscode-list-hoverBackground); }
.preset-info { flex:1; min-width:0; }
.preset-name { font-size:11px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.preset-meta { font-size:10px; opacity:.5; display:flex; gap:6px; }
.preset-mode { background:rgba(91,141,239,.15); color:#5B8DEF; border-radius:3px; padding:0 4px; font-size:9px; font-weight:600; text-transform:uppercase; }
.preset-mode.semantic { background:rgba(94,194,105,.15); color:#5EC269; }
.alert-icon { color:#E8915A; font-size:10px; cursor:help; }
.delete-btn { background:none; border:none; color:var(--vscode-foreground); opacity:.25; cursor:pointer; font-size:12px; }
.delete-btn:hover { opacity:.8; color:#E06C75; }
.empty-msg { padding:24px 16px; text-align:center; opacity:.4; font-size:11px; }
.hidden { display:none; }
`;

const JS = `
const vscode = acquireVsCodeApi();
let allPresets = [];

function esc(s) { return s.replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function render(presets) {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  list.innerHTML = '';
  if (!presets.length) { empty.classList.remove('hidden'); list.classList.add('hidden'); return; }
  empty.classList.add('hidden'); list.classList.remove('hidden');
  presets.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'preset-item';
    const hasManual = p.manualVariables && p.manualVariables.length;
    div.innerHTML = '<div class="preset-info">'
      + '<div class="preset-name">' + esc(p.name) + (hasManual ? ' <span class="alert-icon" title="Requires: ' + esc(p.manualVariables.join(', ')) + '">⚠</span>' : '') + '</div>'
      + '<div class="preset-meta"><span class="preset-mode ' + p.mode + '">' + p.mode + '</span></div>'
      + '</div>'
      + '<button class="delete-btn" data-id="' + p.id + '" title="Delete">✕</button>';
    div.querySelector('.preset-info').addEventListener('click', () => vscode.postMessage({ type:'execute', index: i }));
    div.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); vscode.postMessage({ type:'delete', id: p.id }); });
    list.appendChild(div);
  });
}

document.getElementById('filter').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  render(allPresets.filter(p => p.name.toLowerCase().includes(q)));
});

window.addEventListener('message', (e) => {
  if (e.data.type === 'presets') { allPresets = e.data.presets; render(allPresets); }
});
vscode.postMessage({ type:'ready' });
`;

