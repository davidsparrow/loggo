/**
 * ChatViewProvider — sidebar chat panel.
 *
 * Two modes: Agent (plan/diff/apply) and File Comments.
 * Minimalist icon-based mode toggle, message list, text input.
 */

import * as vscode from 'vscode';
import { ChatMessage, FileComment, ChatMode, ContextItem } from '../types/agent';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'logocode-chat';

  private _view?: vscode.WebviewView;
  private _messages: ChatMessage[] = [];
  private _comments: FileComment[] = [];
  private _context: ContextItem[] = [];
  private _mode: ChatMode = 'agent';

  /** Fires when user sends a message from the chat input */
  public onUserMessage?: (text: string, context: ContextItem[]) => void;

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
        case 'send':
          this.onUserMessage?.(msg.text, this._context);
          break;
        case 'switchMode':
          this._mode = msg.mode;
          this._sync();
          break;
        case 'removeContext':
          this._context = this._context.filter(c => c.id !== msg.id);
          this._sync();
          break;
        case 'ready':
          this._sync();
          break;
      }
    });
  }

  public addMessage(msg: ChatMessage): void { this._messages.push(msg); this._sync(); }
  public setComments(c: FileComment[]): void { this._comments = c; this._sync(); }
  public addContext(item: ContextItem): void { this._context.push(item); this._sync(); }
  public setContext(items: ContextItem[]): void { this._context = items; this._sync(); }

  private _sync(): void {
    if (!this._view) { return; }
    this._view.webview.postMessage({
      type: 'state',
      mode: this._mode,
      messages: this._messages,
      comments: this._comments,
      contextCount: this._context.length,
      contextItems: this._context,
    });
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
    <div class="header">
      <button id="btn-agent" class="mode-btn active" title="Agent">🤖</button>
      <button id="btn-comments" class="mode-btn" title="File Comments">💬</button>
      <span id="ctx-badge" class="ctx-badge hidden" title="Agent context items">0</span>
    </div>
    <div id="messages" class="messages"></div>
    <div class="input-row">
      <textarea id="input" rows="2" placeholder="Ask the agent…"></textarea>
      <button id="btn-send" title="Send">➤</button>
    </div>
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
.header { display:flex; align-items:center; gap:4px; padding:6px 8px; border-bottom:1px solid var(--vscode-panel-border, #333); }
.mode-btn { background:none; border:none; color:var(--vscode-foreground); font-size:14px; cursor:pointer; padding:3px 6px; border-radius:3px; opacity:.5; }
.mode-btn.active { opacity:1; background:var(--vscode-toolbar-activeBackground, rgba(255,255,255,.08)); }
.mode-btn:hover { opacity:.85; }
.ctx-badge { margin-left:auto; background:#5B8DEF; color:#fff; font-size:10px; border-radius:8px; padding:1px 6px; font-weight:600; }
.hidden { display:none; }
.messages { flex:1; overflow-y:auto; padding:8px; }
.msg { margin-bottom:8px; padding:6px 8px; border-radius:6px; font-size:11px; line-height:1.4; white-space:pre-wrap; word-break:break-word; }
.msg.user { background:var(--vscode-input-background); margin-left:20px; }
.msg.agent { background:rgba(91,141,239,.1); margin-right:20px; }
.msg.system { opacity:.6; text-align:center; font-style:italic; }
.msg .role { font-weight:600; font-size:10px; opacity:.6; margin-bottom:2px; }
.comment-item { padding:6px 8px; border-bottom:1px solid var(--vscode-panel-border,#333); font-size:11px; cursor:pointer; }
.comment-item:hover { background:var(--vscode-list-hoverBackground); }
.comment-file { font-weight:600; opacity:.7; font-size:10px; }
.input-row { display:flex; gap:4px; padding:6px 8px; border-top:1px solid var(--vscode-panel-border,#333); }
.input-row textarea { flex:1; resize:none; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border,transparent); border-radius:3px; padding:4px 6px; font-size:11px; font-family:inherit; outline:none; }
.input-row textarea:focus { border-color:var(--vscode-focusBorder); }
.input-row button { background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none; border-radius:3px; padding:4px 8px; cursor:pointer; font-size:13px; }
.input-row button:hover { background:var(--vscode-button-hoverBackground); }
.empty-msg { padding:24px 16px; text-align:center; opacity:.4; font-size:11px; }
`;

const JS = `
const vscode = acquireVsCodeApi();
let currentMode = 'agent';

const btnAgent = document.getElementById('btn-agent');
const btnComments = document.getElementById('btn-comments');
const msgContainer = document.getElementById('messages');
const input = document.getElementById('input');
const ctxBadge = document.getElementById('ctx-badge');

btnAgent.addEventListener('click', () => { vscode.postMessage({ type:'switchMode', mode:'agent' }); });
btnComments.addEventListener('click', () => { vscode.postMessage({ type:'switchMode', mode:'comments' }); });

document.getElementById('btn-send').addEventListener('click', send);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

function send() {
  const text = input.value.trim();
  if (!text) return;
  vscode.postMessage({ type:'send', text });
  input.value = '';
}

function esc(s) { return s.replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

window.addEventListener('message', (e) => {
  const d = e.data;
  if (d.type !== 'state') return;
  currentMode = d.mode;

  btnAgent.classList.toggle('active', d.mode === 'agent');
  btnComments.classList.toggle('active', d.mode === 'comments');
  input.placeholder = d.mode === 'agent' ? 'Ask the agent…' : 'Add a comment…';

  // Context badge
  if (d.contextCount > 0) { ctxBadge.textContent = d.contextCount; ctxBadge.classList.remove('hidden'); }
  else { ctxBadge.classList.add('hidden'); }

  msgContainer.innerHTML = '';
  if (d.mode === 'agent') {
    if (!d.messages.length) { msgContainer.innerHTML = '<div class="empty-msg">Start a conversation with the agent</div>'; return; }
    d.messages.forEach(m => {
      const div = document.createElement('div');
      div.className = 'msg ' + m.role;
      div.innerHTML = '<div class="role">' + m.role + '</div>' + esc(m.content);
      msgContainer.appendChild(div);
    });
    msgContainer.scrollTop = msgContainer.scrollHeight;
  } else {
    if (!d.comments.length) { msgContainer.innerHTML = '<div class="empty-msg">No file comments yet</div>'; return; }
    d.comments.forEach(c => {
      const div = document.createElement('div');
      div.className = 'comment-item';
      const fname = c.filePath.split('/').pop() || c.filePath;
      div.innerHTML = '<div class="comment-file">' + esc(fname) + (c.line ? ':' + c.line : '') + '</div>' + esc(c.content);
      msgContainer.appendChild(div);
    });
  }
});
vscode.postMessage({ type:'ready' });
`;

