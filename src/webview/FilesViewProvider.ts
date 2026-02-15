/**
 * FilesViewProvider — sidebar file tree panel.
 *
 * Shows workspace files in a flat/grouped list with comment badges (green/grey).
 * Clicking a file opens it in the editor and highlights it on the graph.
 */

import * as vscode from 'vscode';
import { FileComment } from '../types/agent';

export class FilesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'logocode-files';

  private _view?: vscode.WebviewView;
  private _files: { path: string; name: string; dir: string }[] = [];
  private _comments: FileComment[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'openFile':
          if (msg.filePath) {
            const uri = vscode.Uri.file(msg.filePath);
            vscode.workspace.openTextDocument(uri).then((doc) =>
              vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
            );
          }
          break;
        case 'ready':
          this._sendFiles();
          break;
      }
    });
  }

  /** Refresh the file list (called after analysis) */
  public setFiles(files: { path: string; name: string; dir: string }[]): void {
    this._files = files;
    this._sendFiles();
  }

  /** Update comment badges */
  public setComments(comments: FileComment[]): void {
    this._comments = comments;
    this._sendFiles();
  }

  private _sendFiles(): void {
    if (!this._view) { return; }
    const commentPaths = new Set(this._comments.map(c => c.filePath));
    const items = this._files.map(f => ({
      ...f,
      hasComment: commentPaths.has(f.path),
    }));
    this._view.webview.postMessage({ type: 'updateFiles', files: items });
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <style>${CSS}</style>
</head>
<body>
  <div class="panel">
    <div class="filter-row">
      <input id="filter" type="text" placeholder="Filter files…" spellcheck="false" />
    </div>
    <ul id="file-list" class="file-list"></ul>
    <div id="empty" class="empty-msg">Run <b>Refresh Analysis</b> to load files</div>
  </div>
  <script nonce="${nonce}">${JS}</script>
</body>
</html>`;
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
.filter-row { padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border, #333); }
.filter-row input { width:100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border:1px solid var(--vscode-input-border, transparent); border-radius:3px; padding:4px 6px; font-size:11px; outline:none; }
.filter-row input:focus { border-color: var(--vscode-focusBorder); }
.file-list { list-style:none; margin:0; padding:0; overflow-y:auto; flex:1; }
.file-list li { display:flex; align-items:center; gap:6px; padding:4px 10px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.file-list li:hover { background: var(--vscode-list-hoverBackground); }
.file-list li .badge { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.badge.has-comment { background: #5EC269; }
.badge.no-comment { background: #555; }
.file-name { opacity:1; }
.file-dir { opacity:.5; font-size:10px; margin-left:auto; }
.empty-msg { padding:16px; text-align:center; opacity:.5; font-size:11px; }
.hidden { display:none; }
`;

const JS = `
const vscode = acquireVsCodeApi();
let allFiles = [];

function render(files) {
  const list = document.getElementById('file-list');
  const empty = document.getElementById('empty');
  list.innerHTML = '';
  if (!files.length) { empty.classList.remove('hidden'); list.classList.add('hidden'); return; }
  empty.classList.add('hidden'); list.classList.remove('hidden');
  files.forEach(f => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="badge ' + (f.hasComment ? 'has-comment' : 'no-comment') + '"></span>'
      + '<span class="file-name">' + esc(f.name) + '</span>'
      + '<span class="file-dir">' + esc(f.dir) + '</span>';
    li.addEventListener('click', () => vscode.postMessage({ type: 'openFile', filePath: f.path }));
    list.appendChild(li);
  });
}
function esc(s) { return s.replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.getElementById('filter').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  render(allFiles.filter(f => f.name.toLowerCase().includes(q) || f.dir.toLowerCase().includes(q)));
});

window.addEventListener('message', (e) => {
  if (e.data.type === 'updateFiles') { allFiles = e.data.files; render(allFiles); }
});
vscode.postMessage({ type: 'ready' });
`;

