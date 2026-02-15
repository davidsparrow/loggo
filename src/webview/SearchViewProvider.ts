/**
 * SearchViewProvider — unified search sidebar panel.
 *
 * Single search tab with Text | Semantic mode toggle.
 * Shared results panel. Actual search execution wired in Chunk 4.
 */

import * as vscode from 'vscode';
import { SearchMode, SearchResultItem } from '../types/search';

export class SearchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'logocode-search';

  private _view?: vscode.WebviewView;
  private _mode: SearchMode = 'text';
  private _results: SearchResultItem[] = [];

  /** Fires when user executes a search */
  public onSearch?: (mode: SearchMode, query: string, opts: Record<string, unknown>) => void;
  /** Fires when user clicks a result */
  public onResultClick?: (result: SearchResultItem) => void;
  /** Fires when user clicks "Add to Agent" on a result */
  public onAddToAgent?: (result: SearchResultItem) => void;

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
        case 'search':
          this._mode = msg.mode;
          this.onSearch?.(msg.mode, msg.query, msg.opts || {});
          break;
        case 'switchMode':
          this._mode = msg.mode;
          this._syncMode();
          break;
        case 'resultClick':
          if (msg.index !== undefined && this._results[msg.index]) {
            this.onResultClick?.(this._results[msg.index]);
          }
          break;
        case 'addToAgent':
          if (msg.index !== undefined && this._results[msg.index]) {
            this.onAddToAgent?.(this._results[msg.index]);
          }
          break;
        case 'ready':
          this._syncMode();
          break;
      }
    });
  }

  /** Push search results into the panel */
  public setResults(results: SearchResultItem[]): void {
    this._results = results;
    this._view?.webview.postMessage({ type: 'results', results });
  }

  /** Set search mode externally (e.g. from saved preset) */
  public setMode(mode: SearchMode): void {
    this._mode = mode;
    this._syncMode();
  }

  /** Pre-fill the search query externally */
  public setQuery(query: string): void {
    this._view?.webview.postMessage({ type: 'setQuery', query });
  }

  private _syncMode(): void {
    this._view?.webview.postMessage({ type: 'modeUpdate', mode: this._mode });
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
    <div class="search-bar">
      <input id="query" type="text" placeholder="Search…" spellcheck="false" />
      <button id="btn-go" title="Search">⌕</button>
    </div>
    <div class="mode-row">
      <label class="radio"><input type="radio" name="mode" value="text" checked /> Text</label>
      <label class="radio"><input type="radio" name="mode" value="semantic" /> Semantic</label>
    </div>
    <div id="text-opts" class="opts">
      <label class="opt"><input type="checkbox" id="opt-regex" /> Regex</label>
      <label class="opt"><input type="checkbox" id="opt-case" /> Match Case</label>
      <label class="opt"><input type="checkbox" id="opt-word" /> Whole Word</label>
      <input id="opt-include" type="text" placeholder="Include glob" spellcheck="false" />
      <input id="opt-exclude" type="text" placeholder="Exclude glob" spellcheck="false" />
    </div>
    <div id="sem-opts" class="opts hidden">
      <label class="opt"><input type="checkbox" id="opt-external" /> Include External Folders</label>
    </div>
    <div id="results" class="results"></div>
    <div id="empty" class="empty-msg">Enter a query to search</div>
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
.search-bar { display:flex; gap:4px; padding:6px 8px; }
.search-bar input { flex:1; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border,transparent); border-radius:3px; padding:4px 6px; font-size:11px; outline:none; }
.search-bar input:focus { border-color:var(--vscode-focusBorder); }
.search-bar button { background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none; border-radius:3px; padding:4px 8px; cursor:pointer; font-size:14px; }
.search-bar button:hover { background:var(--vscode-button-hoverBackground); }
.mode-row { display:flex; gap:12px; padding:2px 10px 6px; border-bottom:1px solid var(--vscode-panel-border,#333); }
.radio { font-size:11px; display:flex; align-items:center; gap:3px; cursor:pointer; opacity:.8; }
.radio input { accent-color:var(--vscode-focusBorder); }
.opts { padding:6px 10px; display:flex; flex-wrap:wrap; gap:4px 10px; border-bottom:1px solid var(--vscode-panel-border,#333); }
.opts input[type="text"] { width:100%; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border,transparent); border-radius:3px; padding:3px 6px; font-size:10px; outline:none; }
.opts input[type="text"]:focus { border-color:var(--vscode-focusBorder); }
.opt { font-size:10px; display:flex; align-items:center; gap:3px; opacity:.75; }
.hidden { display:none; }
.results { flex:1; overflow-y:auto; }
.result-item { display:flex; align-items:flex-start; gap:6px; padding:5px 10px; cursor:pointer; border-bottom:1px solid var(--vscode-panel-border,#222); }
.result-item:hover { background:var(--vscode-list-hoverBackground); }
.result-info { flex:1; min-width:0; }
.result-file { font-weight:600; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.result-preview { font-size:10px; opacity:.65; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.result-line { font-size:10px; opacity:.4; }
.result-add { background:none; border:none; color:var(--vscode-foreground); opacity:.35; cursor:pointer; font-size:12px; padding:2px; flex-shrink:0; }
.result-add:hover { opacity:.9; }
.empty-msg { padding:24px 16px; text-align:center; opacity:.4; font-size:11px; }
`;

const JS = `
const vscode = acquireVsCodeApi();
let currentMode = 'text';
const queryEl = document.getElementById('query');
const textOpts = document.getElementById('text-opts');
const semOpts = document.getElementById('sem-opts');
const resultsEl = document.getElementById('results');
const emptyEl = document.getElementById('empty');

// Mode toggle
document.querySelectorAll('input[name="mode"]').forEach(r => {
  r.addEventListener('change', () => {
    currentMode = r.value;
    vscode.postMessage({ type:'switchMode', mode: currentMode });
    textOpts.classList.toggle('hidden', currentMode !== 'text');
    semOpts.classList.toggle('hidden', currentMode !== 'semantic');
  });
});

// Search
function doSearch() {
  const q = queryEl.value.trim();
  if (!q) return;
  const opts = currentMode === 'text' ? {
    isRegex: document.getElementById('opt-regex').checked,
    isCaseSensitive: document.getElementById('opt-case').checked,
    isWholeWord: document.getElementById('opt-word').checked,
    includeGlob: document.getElementById('opt-include').value || undefined,
    excludeGlob: document.getElementById('opt-exclude').value || undefined,
  } : {
    includeExternalFolders: document.getElementById('opt-external').checked,
  };
  vscode.postMessage({ type:'search', mode: currentMode, query: q, opts });
}

document.getElementById('btn-go').addEventListener('click', doSearch);
queryEl.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

function esc(s) { return s.replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Render results
function renderResults(results) {
  resultsEl.innerHTML = '';
  if (!results.length) { emptyEl.textContent = 'No results'; emptyEl.classList.remove('hidden'); resultsEl.classList.add('hidden'); return; }
  emptyEl.classList.add('hidden'); resultsEl.classList.remove('hidden');
  results.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = '<div class="result-info">'
      + '<div class="result-file">' + esc(r.fileName) + (r.line ? '<span class="result-line"> :' + r.line + '</span>' : '') + '</div>'
      + '<div class="result-preview">' + esc(r.preview) + '</div></div>'
      + '<button class="result-add" data-i="' + i + '" title="Add to Agent">＋</button>';
    div.querySelector('.result-info').addEventListener('click', () => vscode.postMessage({ type:'resultClick', index: i }));
    div.querySelector('.result-add').addEventListener('click', (e) => { e.stopPropagation(); vscode.postMessage({ type:'addToAgent', index: i }); });
    resultsEl.appendChild(div);
  });
}

window.addEventListener('message', (e) => {
  const d = e.data;
  if (d.type === 'results') renderResults(d.results);
  if (d.type === 'setQuery') queryEl.value = d.query;
  if (d.type === 'modeUpdate') {
    currentMode = d.mode;
    document.querySelectorAll('input[name="mode"]').forEach(r => { r.checked = r.value === d.mode; });
    textOpts.classList.toggle('hidden', d.mode !== 'text');
    semOpts.classList.toggle('hidden', d.mode !== 'semantic');
  }
});
vscode.postMessage({ type:'ready' });
`;

