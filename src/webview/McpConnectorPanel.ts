/**
 * McpConnectorPanel — Mock MCP server + External connector management panel.
 *
 * Sections J + K from spec. Currently mock / "Coming Soon" with
 * placeholder cards. Full integration planned for v2.
 */

import * as vscode from 'vscode';
import { McpServer, Connector } from '../types/connectors';

/** Mock MCP servers for demo UI */
const MOCK_MCP_SERVERS: McpServer[] = [
  { id: 'mcp-1', name: 'Local Codemap Server', status: 'stopped', logs: [] },
  { id: 'mcp-2', name: 'Semantic Index Server', status: 'stopped', logs: [] },
];

/** Mock connectors for demo UI */
const MOCK_CONNECTORS: Connector[] = [
  { id: 'con-1', name: 'Gmail', type: 'gmail', status: 'disconnected', enabled: false, hasCredentials: false },
  { id: 'con-2', name: 'Slack', type: 'slack', status: 'disconnected', enabled: false, hasCredentials: false },
  { id: 'con-3', name: 'Google Sheets', type: 'google-sheets', status: 'disconnected', enabled: false, hasCredentials: false },
];

export class McpConnectorPanel {
  private _panel?: vscode.WebviewPanel;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /** Number of mock MCP servers */
  public get mcpCount(): number { return MOCK_MCP_SERVERS.length; }
  /** Number of mock connectors */
  public get connectorCount(): number { return MOCK_CONNECTORS.length; }

  public show(): void {
    if (this._panel) { this._panel.reveal(vscode.ViewColumn.One); return; }

    this._panel = vscode.window.createWebviewPanel(
      'logocode-mcp-connectors',
      'LogoCode — MCP & Connectors',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: false },
    );

    this._panel.webview.html = this._getHtml();

    this._panel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'toggleServer':
          vscode.window.showInformationMessage(`MCP server toggle: ${msg.id} — Coming soon in v2`);
          break;
        case 'toggleConnector':
          vscode.window.showInformationMessage(`Connector toggle: ${msg.id} — Coming soon in v2`);
          break;
      }
    });

    this._panel.onDidDispose(() => { this._panel = undefined; });
  }

  public dispose(): void { this._panel?.dispose(); }

  private _getHtml(): string {
    const nonce = getNonce();
    const serverCards = MOCK_MCP_SERVERS.map(s => `
      <div class="card">
        <div class="card-header">
          <span class="status-dot ${s.status}"></span>
          <span class="card-name">${s.name}</span>
          <span class="coming-soon">Coming Soon</span>
        </div>
        <div class="card-body">
          <span class="card-status">${s.status}</span>
          <button class="toggle-btn" data-id="${s.id}" data-action="toggleServer">
            ${s.status === 'running' ? '■ Stop' : '▶ Start'}
          </button>
        </div>
      </div>`).join('\n');

    const connectorCards = MOCK_CONNECTORS.map(c => `
      <div class="card">
        <div class="card-header">
          <span class="status-dot ${c.status}"></span>
          <span class="card-name">${c.name}</span>
          <span class="badge-type">${c.type}</span>
          <span class="coming-soon">Coming Soon</span>
        </div>
        <div class="card-body">
          <span class="card-status">${c.status}</span>
          <button class="toggle-btn" data-id="${c.id}" data-action="toggleConnector">
            ${c.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>`).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>MCP & Connectors</title>
  <style>${PANEL_CSS}</style>
</head>
<body>
  <div class="panel-root">
    <h2 class="section-title">MCP Servers</h2>
    <div class="card-grid">${serverCards}</div>
    <h2 class="section-title">External Connectors</h2>
    <div class="card-grid">${connectorCards}</div>
  </div>
  <script nonce="${nonce}">${PANEL_JS}</script>
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

const PANEL_CSS = `
body {
  margin: 0; padding: 0;
  font-family: var(--vscode-font-family, system-ui, sans-serif);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}
.panel-root { padding: 20px 24px; max-width: 700px; margin: 0 auto; }
.section-title {
  font-size: 13px; font-weight: 700; letter-spacing: 0.5px;
  text-transform: uppercase; opacity: 0.6;
  margin: 24px 0 12px; padding-bottom: 6px;
  border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
}
.section-title:first-child { margin-top: 0; }
.card-grid { display: flex; flex-direction: column; gap: 8px; }
.card {
  background: var(--vscode-editorWidget-background, #252526);
  border: 1px solid var(--vscode-panel-border, #3c3c3c);
  border-radius: 6px; padding: 10px 14px;
}
.card-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
}
.card-name { font-size: 12px; font-weight: 600; flex: 1; }
.badge-type {
  font-size: 9px; padding: 2px 6px; border-radius: 3px;
  background: var(--vscode-badge-background, #4d4d4d);
  color: var(--vscode-badge-foreground, #ccc);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.coming-soon {
  font-size: 9px; padding: 2px 8px; border-radius: 10px;
  background: #E8915A22; color: #E8915A;
  font-weight: 600; letter-spacing: 0.3px;
}
.status-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.status-dot.running, .status-dot.connected { background: #5EC269; }
.status-dot.stopped, .status-dot.disconnected { background: #8B8B8B; }
.status-dot.error { background: #E06C75; }
.status-dot.starting { background: #E8915A; }
.card-body {
  display: flex; align-items: center; justify-content: space-between;
}
.card-status {
  font-size: 10px; opacity: 0.5; text-transform: capitalize;
}
.toggle-btn {
  background: transparent; color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border, #3c3c3c);
  border-radius: 4px; padding: 3px 10px; font-size: 10px;
  cursor: pointer; opacity: 0.7;
}
.toggle-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, #ffffff1a); }
`;

// ── Embedded JS ──────────────────────────────────────────────

const PANEL_JS = `
const vscode = acquireVsCodeApi();
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    vscode.postMessage({ type: btn.dataset.action, id: btn.dataset.id });
  });
});
`;